package models

import "time"

// User 用户模型
type User struct {
	UID       int64     `json:"uid"`
	Level     int       `json:"level"`
	Exp       int64     `json:"experience"`
	RankScore int       `json:"rank_score"`
	WinsCount int       `json:"wins_count"`
	CreatedAt time.Time `json:"created_at"`
}

// RedisKey Redis 键值对模型
type RedisKey struct {
	Key   string `json:"key"`
	Type  string `json:"type"`
	TTL   int64  `json:"ttl"`
	Value string `json:"value"`
}

// RatingSimInput 积分模拟输入
type RatingSimInput struct {
	PlayerRating   float64 `json:"player_rating"`
	OpponentRating float64 `json:"opponent_rating"`
	WinsCount      int     `json:"wins_count"`
	SurvivorCount  int     `json:"survivor_count"`
	InitialCount   int     `json:"initial_count"`
	Streak         int     `json:"streak"`
	Performance    float64 `json:"performance"`
	IsWinner       bool    `json:"is_winner"`
}

// RatingSimResult 积分模拟结果
type RatingSimResult struct {
	Delta           int     `json:"delta"`
	ExpectedWinRate float64 `json:"expected_win_rate"`
	KFactor         float64 `json:"k_factor"`
	SurvivalWeight  float64 `json:"survival_weight"`
	StreakWeight    float64 `json:"streak_weight"`
	PerfWeight      float64 `json:"perf_weight"`
}

// Config 应用配置
type Config struct {
	UpstreamURL string         `yaml:"upstream_url" json:"upstream_url"`
	Database    DatabaseConfig `yaml:"database" json:"database"`
	Redis       RedisConfig    `yaml:"redis" json:"redis"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	DSN string `yaml:"dsn" json:"dsn"`
}

// RedisConfig Redis 配置
type RedisConfig struct {
	Addr     string `yaml:"addr" json:"addr"`
	Password string `yaml:"password" json:"password"`
	DB       int    `yaml:"db" json:"db"`
}
