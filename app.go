package main

import (
	"context"
	"fmt"
	"log"

	"MCA-Maintenance/internal/config"
	"MCA-Maintenance/internal/logic"
	"MCA-Maintenance/internal/models"
)

// App struct
type App struct {
	ctx context.Context
	svc *logic.MaintenanceService
	cfg *models.Config
}

// NewApp creates a new App application struct
func NewApp() *App {
	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		log.Printf("Warning: Failed to load config: %v", err)
	}

	svc := logic.NewMaintenanceService(cfg)

	return &App{
		svc: svc,
		cfg: cfg,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetConfig 获取当前配置
func (a *App) GetConfig() *models.Config {
	return a.cfg
}

// GetRedisKeys 获取 Redis 键
func (a *App) GetRedisKeys(pattern string) ([]models.RedisKey, error) {
	if a.svc == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.svc.GetRedisKeys(a.ctx, pattern)
}

// DeleteRedisKey 删除 Redis 键
func (a *App) DeleteRedisKey(key string) error {
	if a.svc == nil {
		return fmt.Errorf("service not initialized")
	}
	return a.svc.DeleteRedisKey(a.ctx, key)
}

// GetUsers 获取用户列表
func (a *App) GetUsers() ([]models.User, error) {
	if a.svc == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.svc.GetUsers(a.ctx)
}

// UpdateUserRankScore 更新用户分数
func (a *App) UpdateUserRankScore(uid int64, score int) error {
	if a.svc == nil {
		return fmt.Errorf("service not initialized")
	}
	return a.svc.UpdateUserRankScore(a.ctx, uid, score)
}

// SimulateRating 积分模拟
func (a *App) SimulateRating(input models.RatingSimInput) models.RatingSimResult {
	return logic.SimulateRating(input)
}

// GetSystemStats 获取系统统计信息
func (a *App) GetSystemStats() (models.SystemStats, error) {
	if a.svc == nil {
		return models.SystemStats{}, fmt.Errorf("service not initialized")
	}
	return a.svc.GetSystemStats(a.ctx)
}

// UploadMatchResult 手动上传对局战绩
func (a *App) UploadMatchResult(result models.MatchResult) error {
	if a.svc == nil {
		return fmt.Errorf("service not initialized")
	}
	return a.svc.UploadMatchResult(a.ctx, result)
}

// ─── MCA 业务代理（OPS 凭据由后端持有，前端不接触令牌）───

// ReportMatch 以 OPS 身份上报一局对战（正常端点 POST /api/matches）
func (a *App) ReportMatch(input models.TeamReportInput) (models.Match, error) {
	if a.svc == nil {
		return models.Match{}, fmt.Errorf("service not initialized")
	}
	return a.svc.ReportMatch(a.ctx, input)
}

// GetMatchByID 获取对局详情（含参与者评分变动明细）
func (a *App) GetMatchByID(id int64) (models.Match, error) {
	if a.svc == nil {
		return models.Match{}, fmt.Errorf("service not initialized")
	}
	return a.svc.GetMatchByID(a.ctx, id)
}

// JoinMatchmaking 加入匹配队列（身份为后端服务令牌对应的 UID）；
// partyMembers 为组队预留字段，服务端契约确定前仅在非空时随请求发送
func (a *App) JoinMatchmaking(matchType string, partyMembers []string) (models.QueueEntry, error) {
	if a.svc == nil {
		return models.QueueEntry{}, fmt.Errorf("service not initialized")
	}
	return a.svc.JoinMatchmaking(a.ctx, matchType, partyMembers)
}

// LeaveMatchmaking 离开匹配队列
func (a *App) LeaveMatchmaking() error {
	if a.svc == nil {
		return fmt.Errorf("service not initialized")
	}
	return a.svc.LeaveMatchmaking(a.ctx)
}

// GetMatchmakingStatus 查询排队状态与近期成局记录
func (a *App) GetMatchmakingStatus() (models.MatchmakingStatus, error) {
	if a.svc == nil {
		return models.MatchmakingStatus{}, fmt.Errorf("service not initialized")
	}
	return a.svc.GetMatchmakingStatus(a.ctx)
}

// GetTopRankings 获取指定类型的 Top N 排行榜（只读）
func (a *App) GetTopRankings(rankType string, limit int) ([]models.Ranking, error) {
	if a.svc == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.svc.GetTopRankings(a.ctx, rankType, limit)
}

// GetPlayerHistory 按玩家 UID 查询历史战绩（只读）
func (a *App) GetPlayerHistory(uid int64, limit int) ([]models.PlayerMatchRow, error) {
	if a.svc == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.svc.GetPlayerHistory(a.ctx, uid, limit)
}

// GetUpstreamStatus 探测上游 MCA 服务状态
func (a *App) GetUpstreamStatus() models.UpstreamStatus {
	if a.svc == nil {
		return models.UpstreamStatus{Reachable: false, Message: "service not initialized"}
	}
	return a.svc.GetUpstreamStatus(a.ctx)
}

// GetRequestLog 获取代理层请求日志（最新在前，最近 50 条）
func (a *App) GetRequestLog() []models.RequestLogEntry {
	if a.svc == nil {
		return []models.RequestLogEntry{}
	}
	return a.svc.GetRequestLog()
}

// GetOpsIdentity 获取 OPS 凭据状态（不含令牌明文）
func (a *App) GetOpsIdentity() models.OpsIdentity {
	if a.svc == nil {
		return models.OpsIdentity{}
	}
	return a.svc.GetOpsIdentity()
}

// SaveConfig 保存配置
func (a *App) SaveConfig(cfg models.Config) error {
	if a.svc == nil {
		return fmt.Errorf("service not initialized")
	}
	err := a.svc.SaveConfig(a.ctx, cfg)
	if err == nil {
		a.cfg = &cfg // 同步更新 App 中的配置缓存
	}
	return err
}

// GetConfigHistory 获取配置历史
func (a *App) GetConfigHistory() ([]models.ConfigHistoryItem, error) {
	if a.svc == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.svc.GetConfigHistory(a.ctx)
}

// RestoreConfig 还原配置
func (a *App) RestoreConfig(filename string) error {
	if a.svc == nil {
		return fmt.Errorf("service not initialized")
	}
	err := a.svc.RestoreConfig(a.ctx, filename)
	if err == nil {
		a.cfg = a.svc.GetConfig() // 同步更新 App 中的配置缓存
	}
	return err
}
