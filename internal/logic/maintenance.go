package logic

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"MCA-Maintenance/internal/models"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

type MaintenanceService struct {
	cfg        *models.Config
	db         *sql.DB
	rdb        *redis.Client
	httpClient *http.Client
}

func NewMaintenanceService(cfg *models.Config) *MaintenanceService {
	// 暂时不直接使用数据库和 Redis，但保留初始化逻辑以防后续需要
	db, _ := sql.Open("mysql", cfg.Database.DSN)
	if db != nil {
		db.SetConnMaxLifetime(time.Minute * 3)
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(10)
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	return &MaintenanceService{
		cfg: cfg,
		db:  db,
		rdb: rdb,
		httpClient: &http.Client{
			Timeout: time.Second * 10,
		},
	}
}

// doRequest 发送经过身份验证的 HTTP 请求
func (s *MaintenanceService) doRequest(ctx context.Context, method, path string, body interface{}) ([]byte, error) {
	url := strings.TrimSuffix(s.cfg.UpstreamURL, "/") + path
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if s.cfg.ManagementToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.cfg.ManagementToken)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// executeSQL 使用运维 Token 执行 SQL 语句
func (s *MaintenanceService) executeSQL(ctx context.Context, query string) (json.RawMessage, error) {
	body := map[string]string{"sql": query}
	respBody, err := s.doRequest(ctx, "POST", "/api/maintenance/sql", body)
	if err != nil {
		return nil, err
	}

	var envelope struct {
		Success bool            `json:"success"`
		Data    json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(respBody, &envelope); err != nil {
		return nil, err
	}

	return envelope.Data, nil
}

// GetConfig 获取当前配置
func (s *MaintenanceService) GetConfig() *models.Config {
	return s.cfg
}

// GetRedisKeys 获取 Redis 键列表 (目前 API 仍不支持，除非通过特定的运维 SQL 查询系统表，暂保持原样或说明)
func (s *MaintenanceService) GetRedisKeys(ctx context.Context, pattern string) ([]models.RedisKey, error) {
	return nil, fmt.Errorf("direct redis access is disabled; please use management SQL if needed for database queries")
}

// DeleteRedisKey 删除 Redis 键
func (s *MaintenanceService) DeleteRedisKey(ctx context.Context, key string) error {
	return fmt.Errorf("direct redis access is disabled")
}

// GetUsers 获取用户列表 (通过运维 SQL 获取完整数据)
func (s *MaintenanceService) GetUsers(ctx context.Context) ([]models.User, error) {
	query := "SELECT uid, level, experience, rank_score, wins_count, created_at FROM users WHERE deleted_at IS NULL LIMIT 100"
	data, err := s.executeSQL(ctx, query)
	if err != nil {
		return nil, err
	}

	var users []models.User
	if err := json.Unmarshal(data, &users); err != nil {
		return nil, err
	}

	return users, nil
}

// UpdateUserRankScore 更新用户分数 (通过运维 SQL 直接修正)
func (s *MaintenanceService) UpdateUserRankScore(ctx context.Context, uid int64, score int) error {
	query := fmt.Sprintf("UPDATE users SET rank_score = %d WHERE uid = %d", score, uid)
	_, err := s.executeSQL(ctx, query)
	return err
}

// GetSystemStats 获取系统统计信息 (通过运维 SQL 获取真实数字)
func (s *MaintenanceService) GetSystemStats(ctx context.Context) (models.SystemStats, error) {
	var stats models.SystemStats

	// 1. 获取用户总数
	userData, err := s.executeSQL(ctx, "SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL")
	if err == nil {
		var res []map[string]interface{}
		if json.Unmarshal(userData, &res) == nil && len(res) > 0 {
			if count, ok := res[0]["count"].(float64); ok {
				stats.TotalUsers = int64(count)
			}
		}
	}

	// 2. 获取 Redis 键总数 (如果后端支持通过 SQL 查询监控数据，否则仍为 0)
	// 3. 获取活跃对局数
	matchData, err := s.executeSQL(ctx, "SELECT COUNT(*) as count FROM matches WHERE finished_at IS NULL")
	if err == nil {
		var res []map[string]interface{}
		if json.Unmarshal(matchData, &res) == nil && len(res) > 0 {
			if count, ok := res[0]["count"].(float64); ok {
				stats.ActiveMatches = int64(count)
			}
		}
	}

	return stats, nil
}

// UploadMatchResult 手动上传对局战绩 (作为运维操作，使用 SQL 直接更新)
func (s *MaintenanceService) UploadMatchResult(ctx context.Context, result models.MatchResult) error {
	// 1. 更新用户积分和获胜次数
	winInc := 0
	if result.IsWinner {
		winInc = 1
	}

	updateUserSQL := fmt.Sprintf(
		"UPDATE users SET rank_score = rank_score + %d, wins_count = wins_count + %d WHERE uid = %d",
		result.ScoreDelta, winInc, result.UID,
	)
	_, err := s.executeSQL(ctx, updateUserSQL)
	if err != nil {
		return err
	}

	// 2. 插入战绩记录 (假设存在 matches 表)
	insertMatchSQL := fmt.Sprintf(
		"INSERT INTO matches (match_type, winner_uid, score_delta, created_at) VALUES ('1v1', %d, %d, '%s')",
		result.UID, result.ScoreDelta, result.MatchTime.Format("2006-01-02 15:04:05"),
	)
	_, err = s.executeSQL(ctx, insertMatchSQL)
	return err
}
