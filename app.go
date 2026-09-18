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
