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
	cfg *models.Config
	db  *sql.DB
	rdb *redis.Client
}

func NewMaintenanceService(cfg *models.Config) *MaintenanceService {
	// sql.Open 不会立即建立连接，只是验证 DSN
	db, _ := sql.Open("mysql", cfg.Database.DSN)
	if db != nil {
		db.SetConnMaxLifetime(time.Minute * 3)
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(10)
	}

	// redis.NewClient 只是创建结构体，不会立即尝试连接
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	return &MaintenanceService{
		cfg: cfg,
		db:  db,
		rdb: rdb,
	}
}

// GetConfig 获取当前配置（用于前端展示上游地址）
func (s *MaintenanceService) GetConfig() *models.Config {
	return s.cfg
}

// GetRedisKeys 获取 Redis 键列表
func (s *MaintenanceService) GetRedisKeys(ctx context.Context, pattern string) ([]models.RedisKey, error) {
	if s.rdb == nil {
		return nil, nil
	}
	keys, err := s.rdb.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, err
	}

	result := make([]models.RedisKey, 0, len(keys))
	for _, k := range keys {
		t, _ := s.rdb.Type(ctx, k).Result()
		ttl, _ := s.rdb.TTL(ctx, k).Result()
		val, _ := s.rdb.Get(ctx, k).Result()

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
	if s.rdb == nil {
		return nil
	}
	return s.rdb.Del(ctx, key).Err()
}

// GetUsers 获取用户列表
func (s *MaintenanceService) GetUsers(ctx context.Context) ([]models.User, error) {
	if s.db == nil {
		return nil, nil
	}
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
	if s.db == nil {
		return nil
	}
	_, err := s.db.ExecContext(ctx, "UPDATE users SET rank_score = ? WHERE uid = ?", score, uid)
	return err
}

// GetSystemStats 获取系统统计信息
func (s *MaintenanceService) GetSystemStats(ctx context.Context) (models.SystemStats, error) {
	var stats models.SystemStats

	// 1. 获取用户总数
	if s.db != nil {
		err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&stats.TotalUsers)
		if err != nil {
			return stats, err
		}
	}

	// 2. 获取 Redis 键总数
	if s.rdb != nil {
		count, err := s.rdb.DBSize(ctx).Result()
		if err == nil {
			stats.RedisKeys = count
		}

		// 3. 获取活跃对局数 (假设 Redis 中以 match: 开头的键代表活跃对局)
		matches, err := s.rdb.Keys(ctx, "match:*").Result()
		if err == nil {
			stats.ActiveMatches = int64(len(matches))
		}
	}

	return stats, nil
}

// UploadMatchResult 手动上传对局战绩
func (s *MaintenanceService) UploadMatchResult(ctx context.Context, result models.MatchResult) error {
	if s.db == nil {
		return nil
	}

	// 开启事务
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. 更新用户积分和获胜次数
	var winInc int
	if result.IsWinner {
		winInc = 1
	}

	_, err = tx.ExecContext(ctx,
		"UPDATE users SET rank_score = rank_score + ?, wins_count = wins_count + ? WHERE uid = ?",
		result.ScoreDelta, winInc, result.UID,
	)
	if err != nil {
		return err
	}

	// 2. 提交事务
	return tx.Commit()
}
