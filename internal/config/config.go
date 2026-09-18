package config

import (
	"os"

	"MCA-Maintenance/internal/models"
	"github.com/goccy/go-yaml"
)

const (
	DefaultUpstreamURL = "https://arena.mcnb.dev/"
	DefaultDSN         = "root:@tcp(127.0.0.1:3306)/matchcorearena?parseTime=true"
	DefaultRedisAddr   = "127.0.0.1:6379"
)

func LoadConfig(path string) (*models.Config, error) {
	cfg := &models.Config{
		UpstreamURL: DefaultUpstreamURL,
		Database: models.DatabaseConfig{
			DSN: DefaultDSN,
		},
		Redis: models.RedisConfig{
			Addr: DefaultRedisAddr,
		},
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// 如果文件不存在，返回带默认值的配置
			return cfg, nil
		}
		return nil, err
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}
