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

// SystemStats 系统统计信息
// 仅保留有真实数据源的计数；队列/对局实时数字由 OPS metrics 代理提供
// （knowledge 0009），结构恒零的 active_matches/redis_keys 已移除。
type SystemStats struct {
	TotalUsers int64 `json:"total_users"`
}

// MatchResult 对局战绩模型
type MatchResult struct {
	MatchID       string    `json:"match_id"`
	UID           int64     `json:"uid"`
	Rank          int       `json:"rank"`
	ScoreDelta    int       `json:"score_delta"`
	IsWinner      bool      `json:"is_winner"`
	MatchTime     time.Time `json:"match_time"`
	SurvivorCount int       `json:"survivor_count"`
}

// ConfigHistoryItem 配置历史项
type ConfigHistoryItem struct {
	Version   string    `json:"version"`
	Timestamp time.Time `json:"timestamp"`
	Filename  string    `json:"filename"`
}

// Config 应用配置
type Config struct {
	UpstreamURL     string         `yaml:"upstream_url" json:"upstream_url"`
	ManagementToken string         `yaml:"management_token" json:"management_token"`
	MCA             MCAConfig      `yaml:"mca" json:"mca"`
	Database        DatabaseConfig `yaml:"database" json:"database"`
	Redis           RedisConfig    `yaml:"redis" json:"redis"`
}

// MCAConfig MCA 业务接口的代理凭据配置。
// 令牌只由本进程持有并用于代理调用，绝不下发到前端。
type MCAConfig struct {
	// ReporterToken 对局上报使用的 OPS 级服务令牌（需携带 match:report
	// scope，或服务端 tokens.yaml 中配置的任意服务令牌）。
	// 留空时回落到 ManagementToken（maintenance scope 在服务端等价于全权限）。
	ReporterToken string `yaml:"reporter_token" json:"reporter_token"`
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

// ─── MCA 业务接口模型（字段与 HA-Contract matchcorearena-business.yaml 对齐）───

// ParticipantReport 上报时的单个参与者（Minecraft UUID 必填）。
type ParticipantReport struct {
	UUID         string  `json:"uuid"`
	SurvivalTime int     `json:"survival_time,omitempty"`
	Kills        int     `json:"kills,omitempty"`
	Deaths       int     `json:"deaths,omitempty"`
	PerfTweak    float64 `json:"perf_tweak,omitempty"`
}

// TeamReportInfo 上报中的一支队伍。
type TeamReportInfo struct {
	TeamID       string              `json:"team_id"`
	InitialCount int                 `json:"initial_count,omitempty"`
	AliveCount   int                 `json:"alive_count,omitempty"`
	Members      []ParticipantReport `json:"members"`
}

// TeamReportInput POST /api/matches 的上报参数。
// StartedAt/FinishedAt 为 RFC3339；留空时由代理层补当前时间（服务端要求必填）。
// Source 取值 game/virtual（留空服务端按 game 处理）；virtual 即运维灌入的假对局，
// 与真实对局走同一端点、同一结算路径。
// MatchmakingGroupID 关联匹配成局，用于组队（party）共享结算；0 表示不关联。
type TeamReportInput struct {
	MatchType          string           `json:"match_type"`
	WinnerTeam         TeamReportInfo   `json:"winner_team"`
	LoserTeams         []TeamReportInfo `json:"loser_teams"`
	DurationSeconds    int              `json:"duration_seconds,omitempty"`
	Source             string           `json:"source,omitempty"`
	MatchmakingGroupID int64            `json:"matchmaking_group_id,omitempty"`
	StartedAt          string           `json:"started_at,omitempty"`
	FinishedAt         string           `json:"finished_at,omitempty"`
}

// ParticipantDetail 对局参与者明细（含本局评分变动），随对局详情返回。
// RankScoreAfter 由服务端契约 v1.5.0 起直接返回；旧响应可能缺失（零值），
// 展示侧此时按 max(0, before+delta) 回退。
type ParticipantDetail struct {
	UID             int64  `json:"uid"`
	TeamID          string `json:"team_id"`
	IsWinner        bool   `json:"is_winner"`
	IsDraw          bool   `json:"is_draw"`
	RankScoreBefore int    `json:"rank_score_before"`
	RankScoreDelta  int    `json:"rank_score_delta"`
	RankScoreAfter  int    `json:"rank_score_after"`
	SurvivalTime    int    `json:"survival_time"`
	Kills           int    `json:"kills"`
	Deaths          int    `json:"deaths"`
}

// Match 对局记录。时间字段按服务端返回的字符串原样承载。
// ServerID/GameID 为契约 v1.5.0 新增（game_id 是上报方幂等键）。
type Match struct {
	ID              int64               `json:"id"`
	MatchType       string              `json:"match_type"`
	Source          string              `json:"source"`
	MapName         string              `json:"map_name"`
	ServerID        string              `json:"server_id"`
	GameID          string              `json:"game_id"`
	WinnerTeamID    string              `json:"winner_team_id"`
	SurvivalRate    float64             `json:"survival_rate"`
	DurationSeconds int                 `json:"duration_seconds"`
	StartedAt       string              `json:"started_at"`
	FinishedAt      string              `json:"finished_at"`
	CreatedAt       string              `json:"created_at"`
	Participants    []ParticipantDetail `json:"participants,omitempty"`
}

// MatchListQuery GET /api/matches 的查询参数（OPS 全局浏览）。
// 空串/零值字段不随请求发送；分页由服务端归一（page_size 上限 100）。
type MatchListQuery struct {
	Source       string `json:"source"`
	MapName      string `json:"map_name"`
	GameID       string `json:"game_id"`
	UID          int64  `json:"uid"`
	FinishedFrom string `json:"finished_from"`
	FinishedTo   string `json:"finished_to"`
	PageNum      int    `json:"page_num"`
	PageSize     int    `json:"page_size"`
}

// RejectionRecord 服务端进程内拒绝环的一条记录
// （GET /api/matches/rejections；仅服务端本进程、重启清空）。
type RejectionRecord struct {
	Time   string `json:"time"`
	Code   string `json:"code"`
	GameID string `json:"game_id"`
	Reason string `json:"reason"`
}

// QueueEntry 匹配队列条目。
type QueueEntry struct {
	UID        int64  `json:"uid"`
	MatchType  string `json:"match_type"`
	RankScore  int    `json:"rank_score"`
	EnqueuedAt string `json:"enqueued_at"`
}

// GroupMember 匹配成局成员。
type GroupMember struct {
	UID       int64  `json:"uid"`
	TeamID    string `json:"team_id"`
	RankScore int    `json:"rank_score"`
}

// JoinTarget 成局下发的游戏服务器地址（服务端配置 matchmaking.join_target
// 时出现；未配置时服务端省略该字段）。
type JoinTarget struct {
	Host string `json:"host"`
	Port int    `json:"port"`
}

// FormedGroup 匹配成局记录。
type FormedGroup struct {
	GroupID    int64         `json:"group_id"`
	MatchType  string        `json:"match_type"`
	FormedAt   string        `json:"formed_at"`
	Members    []GroupMember `json:"members"`
	JoinTarget *JoinTarget   `json:"join_target,omitempty"`
	// Room 预占房间名（契约 1.10.0 房间层）；服务端未启用房间清单时省略该字段。
	Room string `json:"room,omitempty"`
}

// QueueStats 队列规模统计（只读展示用）。旧服务端不返回该字段，
// 因此使用指针以区分“缺失”与“全零队列”。
type QueueStats struct {
	Players            int64 `json:"players"`
	Parties            int64 `json:"parties"`
	AverageWaitSeconds int64 `json:"average_wait_seconds"`
}

// MatchAssignment 玩家当前持有的成局路由分配
// （GET /api/matchmaking/assignment/{uuid}，仅 OPS，契约 v1.9.0 起；
// v1.10.0 增加 room 与 reason=no_room_available）。
// assigned=false 时除 reason 外其余字段由服务端省略。
type MatchAssignment struct {
	Assigned   bool        `json:"assigned"`
	Reason     string      `json:"reason,omitempty"`
	GroupID    int64       `json:"group_id,omitempty"`
	MatchType  string      `json:"match_type,omitempty"`
	FormedAt   string      `json:"formed_at,omitempty"`
	TeamID     string      `json:"team_id,omitempty"`
	Room       string      `json:"room,omitempty"`
	JoinTarget *JoinTarget `json:"join_target,omitempty"`
}

// MatchmakingStatus 当前令牌身份在匹配系统中的状态。
type MatchmakingStatus struct {
	InQueue      bool          `json:"in_queue"`
	QueueEntry   *QueueEntry   `json:"queue_entry,omitempty"`
	RecentGroups []FormedGroup `json:"recent_groups"`
	QueueStats   *QueueStats   `json:"queue_stats,omitempty"`
}

// MetricsSnapshot 服务端可观测性快照（GET /api/metrics，仅 OPS 可读）。
type MetricsSnapshot struct {
	Counters   map[string]int64 `json:"counters"`
	QueueDepth map[string]int64 `json:"queue_depth"`
}

// Ranking 排行榜条目。服务端实际返回 user_uid；user_uuid 为契约旧字段，
// 两者都承载、按非空展示，避免契约漂移导致页面失效。
type Ranking struct {
	ID           int64  `json:"id"`
	UserUID      int64  `json:"user_uid"`
	UserUUID     string `json:"user_uuid"`
	RankType     string `json:"rank_type"`
	Score        int64  `json:"score"`
	RankPosition int    `json:"rank_position"`
	Season       int    `json:"season"`
	UpdatedAt    string `json:"updated_at"`
}

// PlayerMatchRow 按玩家查询的历史战绩行（经运维 SQL 联表得到）。
type PlayerMatchRow struct {
	MatchID         int64  `json:"match_id"`
	MatchType       string `json:"match_type"`
	Source          string `json:"source"`
	MapName         string `json:"map_name"`
	WinnerTeamID    string `json:"winner_team_id"`
	DurationSeconds int    `json:"duration_seconds"`
	StartedAt       string `json:"started_at"`
	FinishedAt      string `json:"finished_at"`
	TeamID          string `json:"team_id"`
	IsWinner        int    `json:"is_winner"`
	IsDraw          int    `json:"is_draw"`
	RankScoreBefore int    `json:"rank_score_before"`
	RankScoreDelta  int    `json:"rank_score_delta"`
}

// UpstreamStatus GET /api/status 的探测结果。
type UpstreamStatus struct {
	Reachable bool   `json:"reachable"`
	Version   string `json:"version"`
	Message   string `json:"message"`
}

// RequestLogEntry 代理层请求日志的一条记录（供 debug 台 Request log 展示）。
type RequestLogEntry struct {
	Time   string `json:"time"`           // 本地时间 15:04:05
	Method string `json:"method"`         // HTTP 方法
	Path   string `json:"path"`           // 上游路径（不含域名）
	Status int    `json:"status"`         // HTTP 状态码；0 表示连接失败
	Code   string `json:"code,omitempty"` // 上游类型化错误码（可为空）
	OK     bool   `json:"ok"`             // 2xx 记为 true
}

// OpsIdentity OPS 凭据状态（不含任何令牌明文，仅供界面指示）。
type OpsIdentity struct {
	ReporterConfigured bool   `json:"reporter_configured"` // mca.reporter_token 已配置
	UsingFallback      bool   `json:"using_fallback"`      // 实际回落到 management_token
	UpstreamURL        string `json:"upstream_url"`        // 当前上游地址
}
