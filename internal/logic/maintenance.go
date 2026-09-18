package logic

import (
	"context"
	"database/sql"
	"time"

	"MCA-Maintenance/internal/models"
	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

type MaintenanceService struct {
	db  *sql.DB
	rdb *redis.Client
}

func NewMaintenanceService(dbDSN string, redisAddr string, redisPass string, redisDB int) (*MaintenanceService, error) {
	db, err := sql.Open("mysql", dbDSN)
	if err != nil {
		return nil, err
	}
	db.SetConnMaxLifetime(time.Minute * 3)
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(10)

	rdb := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPass,
		DB:       redisDB,
	})

	return &MaintenanceService{
		db:  db,
		rdb: rdb,
	}, nil
}

// GetRedisKeys 获取 Redis 键列表
func (s *MaintenanceService) GetRedisKeys(ctx context.Context, pattern string) ([]models.RedisKey, error) {
	keys, err := s.rdb.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, err
	}

	result := make([]models.RedisKey, 0, len(keys))
	for _, k := range keys {
		t, _ := s.rdb.Type(ctx, k).Result()
		ttl, _ := s.rdb.TTL(ctx, k).Result()
		val, _ := s.rdb.Get(ctx, k).Result() // 仅支持 string 类型展示，其他类型可扩展

		result = append(result, models.RedisKey{
			Key:   k,
			Type:  t,
			TTL:   int64(ttl.Seconds()),
			Value: val,
		})
	}
	return result, nil
}

// DeleteRedisKey 删除 Redis 键
func (s *MaintenanceService) DeleteRedisKey(ctx context.Context, key string) error {
	return s.rdb.Del(ctx, key).Err()
}

// GetUsers 获取用户列表
func (s *MaintenanceService) GetUsers(ctx context.Context) ([]models.User, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT uid, level, experience, rank_score, wins_count, created_at FROM users WHERE deleted_at IS NULL LIMIT 100")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		var createdAt string
		if err := rows.Scan(&u.UID, &u.Level, &u.Exp, &u.RankScore, &u.WinsCount, &createdAt); err != nil {
			return nil, err
		}
		u.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
		users = append(users, u)
	}
	return users, nil
}

// UpdateUserRankScore 更新用户分数
func (s *MaintenanceService) UpdateUserRankScore(ctx context.Context, uid int64, score int) error {
	_, err := s.db.ExecContext(ctx, "UPDATE users SET rank_score = ? WHERE uid = ?", score, uid)
	return err
}
