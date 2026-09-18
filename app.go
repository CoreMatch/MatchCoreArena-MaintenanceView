package main

import (
	"context"
	"fmt"
	"log"

	"MCA-Maintenance/internal/logic"
	"MCA-Maintenance/internal/models"
)

// App struct
type App struct {
	ctx     context.Context
	svc     *logic.MaintenanceService
}

// NewApp creates a new App application struct
func NewApp() *App {
	// 默认连接配置，实际可从配置文件加载
	dsn := "root:@tcp(127.0.0.1:3306)/matchcorearena?parseTime=true"
	redisAddr := "127.0.0.1:6379"
	
	svc, err := logic.NewMaintenanceService(dsn, redisAddr, "", 0)
	if err != nil {
		log.Printf("Warning: Failed to connect to services: %v", err)
	}

	return &App{
		svc: svc,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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
