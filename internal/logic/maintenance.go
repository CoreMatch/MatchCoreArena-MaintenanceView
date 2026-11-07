package logic

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"MCA-Maintenance/internal/models"

	_ "github.com/go-sql-driver/mysql"
	"github.com/goccy/go-yaml"
	"github.com/redis/go-redis/v9"
)

type MaintenanceService struct {
	cfg        *models.Config
	db         *sql.DB
	rdb        *redis.Client
	httpClient *http.Client

	// reqMu/reqLog 代理层请求日志（环形缓冲，最近 requestLogCap 条，
	// 供 debug 台的 Request log 区展示）。
	reqMu  sync.Mutex
	reqLog []models.RequestLogEntry
}

// requestLogCap 请求日志保留的最大条数。
const requestLogCap = 50

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
		s.recordRequest(method, path, 0, "", false)
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		s.recordRequest(method, path, resp.StatusCode, "", false)
		return nil, err
	}

	if resp.StatusCode >= 400 {
		s.recordRequest(method, path, resp.StatusCode, parseMCAErrorCode(respBody), false)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	s.recordRequest(method, path, resp.StatusCode, "", true)
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
// 与服务端结算路径同口径：积分下限为 0（GREATEST(0, ...)），
// 运维修正不得把 rank_score 写成负数。
func (s *MaintenanceService) UpdateUserRankScore(ctx context.Context, uid int64, score int) error {
	query := fmt.Sprintf("UPDATE users SET rank_score = GREATEST(0, %d) WHERE uid = %d", score, uid)
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

	// 活跃对局/Redis 键计数已移除：baseline schema 中 finished_at 为
	// NOT NULL，“进行中”无法表达，旧计数恒为 0；面板的队列/对局实时
	// 数字改由 OPS metrics 代理提供（knowledge 0009）。

	return stats, nil
}

// UploadMatchResult 手动上传对局战绩 (作为运维操作，使用 SQL 直接更新)
func (s *MaintenanceService) UploadMatchResult(ctx context.Context, result models.MatchResult) error {
	// 1. 更新用户积分和获胜次数
	winInc := 0
	if result.IsWinner {
		winInc = 1
	}

	// 与服务端结算路径同口径：积分下限为 0（GREATEST(0, ...)），
	// 手动上传不得把 rank_score 写成负数。
	updateUserSQL := fmt.Sprintf(
		"UPDATE users SET rank_score = GREATEST(0, rank_score + %d), wins_count = wins_count + %d WHERE uid = %d",
		result.ScoreDelta, winInc, result.UID,
	)
	_, err := s.executeSQL(ctx, updateUserSQL)
	if err != nil {
		return err
	}

	// 2. 插入战绩记录（列以 MatchCoreArena-Server 的 baseline schema 为准：
	// matches 无 score_delta 列；started_at/finished_at 为 NOT NULL 且无默认值，
	// 取本条记录唯一的可用时间 MatchTime）
	matchTime := result.MatchTime.Format("2006-01-02 15:04:05")
	insertMatchSQL := fmt.Sprintf(
		"INSERT INTO matches (match_type, winner_uid, started_at, finished_at, created_at) VALUES ('1v1', %d, '%s', '%s', '%s')",
		result.UID, matchTime, matchTime, matchTime,
	)
	_, err = s.executeSQL(ctx, insertMatchSQL)
	return err
}

// SaveConfig 保存配置并备份旧版本
func (s *MaintenanceService) SaveConfig(ctx context.Context, cfg models.Config) error {
	// 1. 确保备份目录存在
	historyDir := "config_history"
	if err := os.MkdirAll(historyDir, 0755); err != nil {
		return err
	}

	// 2. 如果旧配置文件存在，先备份
	configPath := "config.yaml"
	if _, err := os.Stat(configPath); err == nil {
		backupFilename := fmt.Sprintf("config_%s.yaml", time.Now().Format("20060102_150405"))
		backupPath := filepath.Join(historyDir, backupFilename)

		data, err := os.ReadFile(configPath)
		if err == nil {
			_ = os.WriteFile(backupPath, data, 0644)
		}
	}

	// 3. 保存新配置
	newData, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}

	err = os.WriteFile(configPath, newData, 0644)
	if err == nil {
		s.cfg = &cfg // 更新内存中的配置
	}
	return err
}

// GetConfigHistory 获取配置备份历史
func (s *MaintenanceService) GetConfigHistory(ctx context.Context) ([]models.ConfigHistoryItem, error) {
	historyDir := "config_history"
	files, err := os.ReadDir(historyDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []models.ConfigHistoryItem{}, nil
		}
		return nil, err
	}

	var history []models.ConfigHistoryItem
	for _, f := range files {
		if !f.IsDir() && strings.HasPrefix(f.Name(), "config_") && strings.HasSuffix(f.Name(), ".yaml") {
			info, err := f.Info()
			if err != nil {
				continue
			}

			// 从文件名解析版本号 (时间戳)
			version := strings.TrimSuffix(strings.TrimPrefix(f.Name(), "config_"), ".yaml")

			history = append(history, models.ConfigHistoryItem{
				Version:   version,
				Timestamp: info.ModTime(),
				Filename:  f.Name(),
			})
		}
	}

	// 按时间倒序排列
	sort.Slice(history, func(i, j int) bool {
		return history[i].Timestamp.After(history[j].Timestamp)
	})

	return history, nil
}

// RestoreConfig 还原指定版本的配置
func (s *MaintenanceService) RestoreConfig(ctx context.Context, filename string) error {
	historyDir := "config_history"
	backupPath := filepath.Join(historyDir, filename)
	configPath := "config.yaml"

	// 1. 读取备份文件
	data, err := os.ReadFile(backupPath)
	if err != nil {
		return err
	}

	// 2. 备份当前配置
	currentBackup := fmt.Sprintf("config_before_restore_%s.yaml", time.Now().Format("20060102_150405"))
	currentData, _ := os.ReadFile(configPath)
	if len(currentData) > 0 {
		_ = os.WriteFile(filepath.Join(historyDir, currentBackup), currentData, 0644)
	}

	// 3. 覆盖当前配置
	err = os.WriteFile(configPath, data, 0644)
	if err != nil {
		return err
	}

	// 4. 尝试更新内存配置
	var newCfg models.Config
	if err := yaml.Unmarshal(data, &newCfg); err == nil {
		s.cfg = &newCfg
	}

	return nil
}
