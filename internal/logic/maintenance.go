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
	if s.cfg.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.cfg.APIToken)
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

// GetConfig 获取当前配置
func (s *MaintenanceService) GetConfig() *models.Config {
	return s.cfg
}

// GetRedisKeys 获取 Redis 键列表 (通过 API 暂时无法获取，返回空)
func (s *MaintenanceService) GetRedisKeys(ctx context.Context, pattern string) ([]models.RedisKey, error) {
	// 暂时不直接访问 Redis
	return nil, fmt.Errorf("direct redis access is disabled; public API does not support key listing")
}

// DeleteRedisKey 删除 Redis 键 (通过 API 暂时无法操作)
func (s *MaintenanceService) DeleteRedisKey(ctx context.Context, key string) error {
	// 暂时不直接访问 Redis
	return fmt.Errorf("direct redis access is disabled")
}

// GetUsers 获取用户列表 (通过排行榜 API 模拟)
func (s *MaintenanceService) GetUsers(ctx context.Context) ([]models.User, error) {
	respBody, err := s.doRequest(ctx, "GET", "/api/rankings/1v1?limit=100", nil)
	if err != nil {
		return nil, err
	}

	var envelope struct {
		Success bool `json:"success"`
		Data    []struct {
			UserUUID  string    `json:"user_uuid"`
			Score     int       `json:"score"`
			UpdatedAt time.Time `json:"updated_at"`
		} `json:"data"`
	}

	if err := json.Unmarshal(respBody, &envelope); err != nil {
		return nil, err
	}

	var users []models.User
	for _, r := range envelope.Data {
		users = append(users, models.User{
			UID:       0, // API 使用 UUID，此处 UID 设为 0 或转换
			RankScore: r.Score,
			CreatedAt: r.UpdatedAt,
		})
	}
	return users, nil
}

// UpdateUserRankScore 更新用户分数 (通过公开 API 无法直接更新，此处可能需要管理 API)
func (s *MaintenanceService) UpdateUserRankScore(ctx context.Context, uid int64, score int) error {
	return fmt.Errorf("direct score update is disabled; please use match result upload instead")
}

// GetSystemStats 获取系统统计信息 (通过 /status 接口)
func (s *MaintenanceService) GetSystemStats(ctx context.Context) (models.SystemStats, error) {
	respBody, err := s.doRequest(ctx, "GET", "/status", nil)
	if err != nil {
		return models.SystemStats{}, err
	}

	// 假设 /status 返回一些基本信息，如果没有则返回占位符
	var stats models.SystemStats
	// 这里可以根据实际 API 响应解析，目前按规范仅返回 SuccessEnvelope
	_ = respBody

	return stats, nil
}

// UploadMatchResult 手动上传对局战绩 (通过 /api/matches 接口)
func (s *MaintenanceService) UploadMatchResult(ctx context.Context, result models.MatchResult) error {
	// 按照 HA-Contract 的 TeamReportInput 结构构造请求
	type Participant struct {
		UUID string `json:"uuid"`
	}
	type TeamInfo struct {
		TeamID  string        `json:"team_id"`
		Members []Participant `json:"members"`
	}
	type MatchReport struct {
		MatchType  string     `json:"match_type"`
		WinnerTeam TeamInfo   `json:"winner_team"`
		LoserTeams []TeamInfo `json:"loser_teams"`
		StartedAt  time.Time  `json:"started_at"`
		FinishedAt time.Time  `json:"finished_at"`
	}

	report := MatchReport{
		MatchType: "1v1",
		WinnerTeam: TeamInfo{
			TeamID:  "winner",
			Members: []Participant{{UUID: fmt.Sprintf("%d", result.UID)}}, // 暂时用 UID 充当 UUID
		},
		StartedAt:  result.MatchTime.Add(-10 * time.Minute),
		FinishedAt: result.MatchTime,
	}

	if !result.IsWinner {
		report.LoserTeams = []TeamInfo{report.WinnerTeam}
		report.WinnerTeam = TeamInfo{TeamID: "other"}
	}

	_, err := s.doRequest(ctx, "POST", "/api/matches", report)
	return err
}
