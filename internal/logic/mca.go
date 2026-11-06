package logic

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"MCA-Maintenance/internal/models"
)

// 本文件实现 MCA 业务接口的代理层：浏览器侧（Wails 前端）只调用本进程
// 暴露的方法，OPS 级服务令牌由本进程按 config.yaml 持有并附加到上游
// 请求，绝不下发到前端。面向操作者的提示文案统一为英文（产品 i18n 方向：
// 英文为主）。

// mcaErrorEnvelope 上游统一错误信封（HA-Contract ErrorEnvelope）。
type mcaErrorEnvelope struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Code    string `json:"code"`
	Error   string `json:"error"`
	Meta    struct {
		RequestID string `json:"request_id"`
	} `json:"meta"`
}

// mcaSuccessEnvelope 上游统一成功信封。
type mcaSuccessEnvelope struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

// mcaErrorCodeMessages 类型化错误码到可读提示（英文）的映射。
// 未列出的错误码回落到信封自带 message。
var mcaErrorCodeMessages = map[string]string{
	"mca_not_implemented":      "This feature is not implemented on the server yet (friend/team endpoints answer 501)",
	"mca_user_not_found":       "Participant Minecraft UUID is unknown to HRPAuth; identity cannot be resolved",
	"mca_user_not_provisioned": "Participant account cannot be provisioned locally (UID held by a soft-deleted row); the whole match was rolled back",
	"mca_invalid_request":      "Invalid request parameters (check team/member structure and timestamp format)",
	"mca_match_not_found":      "Match does not exist",
	"mca_report_inconsistent":  "Report rejected: the match data is self-inconsistent (teams/results/counts/timestamps)",
	"mca_game_id_conflict":     "game_id was already recorded with a different payload (idempotency conflict)",
	"mca_queue_already_joined": "This identity is already in the matchmaking queue (one entry per identity)",
	"mca_queue_not_joined":     "This identity is not in the matchmaking queue",
	"oauth_insufficient_scope": "Reporting requires an OPS token with the match:report scope.",
	"oauth_hrpauth_down":       "HRPAuth upstream unavailable (service credentials or upstream outage); retry later",
	"oauth_token_expired":      "Access token expired",
	"oauth_login_required":     "Reporting requires an OPS token with the match:report scope. (no credentials were sent)",
	"oauth_invalid_grant":      "Token invalid or revoked",
	"invalid_json_body":        "Request body is not valid JSON",
	"invalid_request":          "Invalid request parameters",
	"internal_error":           "Server internal error",
}

// parseMCAErrorEnvelope 尝试从响应体解析类型化错误信封，返回错误码。
// 解析失败返回空串。
func parseMCAErrorCode(rawBody []byte) string {
	var envelope mcaErrorEnvelope
	if err := json.Unmarshal(rawBody, &envelope); err != nil {
		return ""
	}
	return envelope.Code
}

// translateMCAError 把上游错误信封翻译成可读错误。
// rawBody 为原始响应体；解析失败时退化为状态码 + 原文。
func translateMCAError(status int, rawBody []byte) error {
	var envelope mcaErrorEnvelope
	if err := json.Unmarshal(rawBody, &envelope); err != nil || envelope.Code == "" {
		body := strings.TrimSpace(string(rawBody))
		if len(body) > 300 {
			body = body[:300] + "..."
		}
		return fmt.Errorf("MCA request failed (HTTP %d): %s", status, body)
	}

	code := envelope.Code
	msg, ok := mcaErrorCodeMessages[code]
	if !ok {
		msg = envelope.Message
	}
	if msg == "" {
		msg = "unknown error"
	}
	return fmt.Errorf("%s (code %s, HTTP %d)", msg, code, status)
}

// serviceToken 返回代理业务调用使用的 OPS 级令牌：
// 优先 mca.reporter_token，留空时回落 management_token。
func (s *MaintenanceService) serviceToken() string {
	if s.cfg != nil && s.cfg.MCA.ReporterToken != "" {
		return s.cfg.MCA.ReporterToken
	}
	if s.cfg != nil {
		return s.cfg.ManagementToken
	}
	return ""
}

// recordRequest 把一次代理调用记入请求日志环形缓冲（最近 requestLogCap 条）。
func (s *MaintenanceService) recordRequest(method, path string, status int, code string, ok bool) {
	entry := models.RequestLogEntry{
		Time:   time.Now().Format("15:04:05"),
		Method: method,
		Path:   path,
		Status: status,
		Code:   code,
		OK:     ok,
	}
	s.reqMu.Lock()
	defer s.reqMu.Unlock()
	s.reqLog = append(s.reqLog, entry)
	if len(s.reqLog) > requestLogCap {
		s.reqLog = s.reqLog[len(s.reqLog)-requestLogCap:]
	}
}

// GetRequestLog 返回请求日志（最新在前）。
func (s *MaintenanceService) GetRequestLog() []models.RequestLogEntry {
	s.reqMu.Lock()
	defer s.reqMu.Unlock()
	out := make([]models.RequestLogEntry, 0, len(s.reqLog))
	for i := len(s.reqLog) - 1; i >= 0; i-- {
		out = append(out, s.reqLog[i])
	}
	return out
}

// GetOpsIdentity 返回 OPS 凭据状态（不含令牌明文），供界面指示。
func (s *MaintenanceService) GetOpsIdentity() models.OpsIdentity {
	id := models.OpsIdentity{}
	if s.cfg != nil {
		id.UpstreamURL = s.cfg.UpstreamURL
		id.ReporterConfigured = strings.TrimSpace(s.cfg.MCA.ReporterToken) != ""
		id.UsingFallback = !id.ReporterConfigured && strings.TrimSpace(s.cfg.ManagementToken) != ""
	}
	return id
}

// doMCARequest 向上游业务端点发起带鉴权的请求并返回成功信封中的 data。
// 非 2xx 响应会被翻译成类型化的可读错误；每次调用都记入请求日志。
func (s *MaintenanceService) doMCARequest(ctx context.Context, method, path string, body interface{}, token string) (json.RawMessage, error) {
	if s.cfg == nil || strings.TrimSpace(s.cfg.UpstreamURL) == "" {
		return nil, fmt.Errorf("upstream_url is not configured; cannot call MCA")
	}

	url := strings.TrimSuffix(s.cfg.UpstreamURL, "/") + path
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.recordRequest(method, path, 0, "", false)
		return nil, fmt.Errorf("Backend unreachable: %s (%s)", url, err.Error())
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		s.recordRequest(method, path, resp.StatusCode, "", false)
		return nil, fmt.Errorf("failed to read MCA response: %w", err)
	}

	if resp.StatusCode >= 400 {
		code := parseMCAErrorCode(respBody)
		s.recordRequest(method, path, resp.StatusCode, code, false)
		return nil, translateMCAError(resp.StatusCode, respBody)
	}

	s.recordRequest(method, path, resp.StatusCode, "", true)

	var envelope mcaSuccessEnvelope
	if err := json.Unmarshal(respBody, &envelope); err != nil {
		return nil, fmt.Errorf("failed to parse MCA response: %w", err)
	}
	return envelope.Data, nil
}

// ─── 对局上报（开发者 debug：用正常端点 POST /api/matches 灌入对局）───

// ReportMatch 以 OPS 身份上报一局对战。
// started_at/finished_at 留空时补当前时间（服务端要求必填）。
// 返回的 Match 不含参与者明细，评分明细需再调 GetMatchByID。
func (s *MaintenanceService) ReportMatch(ctx context.Context, input models.TeamReportInput) (models.Match, error) {
	var empty models.Match

	if strings.TrimSpace(input.MatchType) == "" {
		return empty, fmt.Errorf("match_type must not be empty")
	}
	if len(input.WinnerTeam.Members) == 0 {
		return empty, fmt.Errorf("the winner team needs at least one member")
	}
	if len(input.LoserTeams) == 0 {
		return empty, fmt.Errorf("at least one loser team is required")
	}

	now := time.Now().Format(time.RFC3339)
	if strings.TrimSpace(input.StartedAt) == "" {
		input.StartedAt = now
	}
	if strings.TrimSpace(input.FinishedAt) == "" {
		input.FinishedAt = now
	}

	data, err := s.doMCARequest(ctx, http.MethodPost, "/api/matches", input, s.serviceToken())
	if err != nil {
		return empty, err
	}

	var match models.Match
	if err := json.Unmarshal(data, &match); err != nil {
		return empty, fmt.Errorf("failed to parse match record: %w", err)
	}
	return match, nil
}

// GetMatchByID 获取对局详情（含参与者评分 before/delta 明细）。
func (s *MaintenanceService) GetMatchByID(ctx context.Context, id int64) (models.Match, error) {
	var empty models.Match
	data, err := s.doMCARequest(ctx, http.MethodGet, fmt.Sprintf("/api/matches/%d", id), nil, s.serviceToken())
	if err != nil {
		return empty, err
	}

	var match models.Match
	if err := json.Unmarshal(data, &match); err != nil {
		return empty, fmt.Errorf("failed to parse match detail: %w", err)
	}
	return match, nil
}

// ─── OPS 只读查询（契约 v1.5.0：全局浏览 / game_id 直查 / 拒绝记录）───

// ListMatches 全局对局查询（GET /api/matches，仅 OPS）：分页 + 过滤，
// 按 finished_at 倒序，条目与单局详情同形状（含参与者明细）。
func (s *MaintenanceService) ListMatches(ctx context.Context, q models.MatchListQuery) ([]models.Match, error) {
	params := url.Values{}
	if v := strings.TrimSpace(q.Source); v != "" {
		params.Set("source", v)
	}
	if v := strings.TrimSpace(q.MapName); v != "" {
		params.Set("map_name", v)
	}
	if v := strings.TrimSpace(q.GameID); v != "" {
		params.Set("game_id", v)
	}
	if q.UID != 0 {
		params.Set("uid", strconv.FormatInt(q.UID, 10))
	}
	if v := strings.TrimSpace(q.FinishedFrom); v != "" {
		params.Set("finished_from", v)
	}
	if v := strings.TrimSpace(q.FinishedTo); v != "" {
		params.Set("finished_to", v)
	}
	pageNum := q.PageNum
	if pageNum <= 0 {
		pageNum = 1
	}
	pageSize := q.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	params.Set("page_num", strconv.Itoa(pageNum))
	params.Set("page_size", strconv.Itoa(pageSize))

	data, err := s.doMCARequest(ctx, http.MethodGet, "/api/matches?"+params.Encode(), nil, s.serviceToken())
	if err != nil {
		return nil, err
	}
	if string(data) == "null" || len(data) == 0 {
		return []models.Match{}, nil
	}

	var matches []models.Match
	if err := json.Unmarshal(data, &matches); err != nil {
		return nil, fmt.Errorf("failed to parse match list: %w", err)
	}
	if matches == nil {
		matches = []models.Match{}
	}
	return matches, nil
}

// GetMatchByGameID 按幂等键直查对局（GET /api/matches/by-game-id/{game_id}，
// 仅 OPS）；未命中时上游返回 404 mca_match_not_found（经翻译可读）。
func (s *MaintenanceService) GetMatchByGameID(ctx context.Context, gameID string) (models.Match, error) {
	var empty models.Match
	if strings.TrimSpace(gameID) == "" {
		return empty, fmt.Errorf("game_id must not be empty")
	}

	path := "/api/matches/by-game-id/" + url.PathEscape(strings.TrimSpace(gameID))
	data, err := s.doMCARequest(ctx, http.MethodGet, path, nil, s.serviceToken())
	if err != nil {
		return empty, err
	}

	var match models.Match
	if err := json.Unmarshal(data, &match); err != nil {
		return empty, fmt.Errorf("failed to parse match detail: %w", err)
	}
	return match, nil
}

// GetMatchRejections 获取服务端进程内拒绝环快照（GET /api/matches/rejections，
// 仅 OPS）：最近 200 条，服务端重启即清空。返回顺序为最旧在前，展示侧倒序。
func (s *MaintenanceService) GetMatchRejections(ctx context.Context) ([]models.RejectionRecord, error) {
	data, err := s.doMCARequest(ctx, http.MethodGet, "/api/matches/rejections", nil, s.serviceToken())
	if err != nil {
		return nil, err
	}
	if string(data) == "null" || len(data) == 0 {
		return []models.RejectionRecord{}, nil
	}

	var records []models.RejectionRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, fmt.Errorf("failed to parse rejection records: %w", err)
	}
	if records == nil {
		records = []models.RejectionRecord{}
	}
	return records, nil
}

// ─── 匹配（以当前服务令牌对应的身份操作）───

// JoinMatchmaking 加入匹配队列。
// partyMembers 为组队入队名单（与服务端 party_members 字段同名）：非空时以
// party_members 随请求体发送，服务端将整队作为一个匹配单元入队，成局后不拆队，
// 结算时同队成员共享评分变动（需在上报对局时携带 matchmaking_group_id）。
func (s *MaintenanceService) JoinMatchmaking(ctx context.Context, matchType string, partyMembers []string) (models.QueueEntry, error) {
	var empty models.QueueEntry
	if strings.TrimSpace(matchType) == "" {
		return empty, fmt.Errorf("match_type must not be empty")
	}

	body := map[string]interface{}{"match_type": matchType}
	cleaned := make([]string, 0, len(partyMembers))
	for _, m := range partyMembers {
		if trimmed := strings.TrimSpace(m); trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	if len(cleaned) > 0 {
		body["party_members"] = cleaned
	}

	data, err := s.doMCARequest(ctx, http.MethodPost, "/api/matchmaking/join", body, s.serviceToken())
	if err != nil {
		return empty, err
	}

	var entry models.QueueEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return empty, fmt.Errorf("failed to parse queue entry: %w", err)
	}
	return entry, nil
}

// LeaveMatchmaking 离开匹配队列。
func (s *MaintenanceService) LeaveMatchmaking(ctx context.Context) error {
	_, err := s.doMCARequest(ctx, http.MethodDelete, "/api/matchmaking/leave", nil, s.serviceToken())
	return err
}

// GetMatchmakingStatus 查询当前身份的排队状态与近期成局。
func (s *MaintenanceService) GetMatchmakingStatus(ctx context.Context) (models.MatchmakingStatus, error) {
	var empty models.MatchmakingStatus
	data, err := s.doMCARequest(ctx, http.MethodGet, "/api/matchmaking/status", nil, s.serviceToken())
	if err != nil {
		return empty, err
	}

	var status models.MatchmakingStatus
	if err := json.Unmarshal(data, &status); err != nil {
		return empty, fmt.Errorf("failed to parse matchmaking status: %w", err)
	}
	if status.RecentGroups == nil {
		status.RecentGroups = []models.FormedGroup{}
	}
	return status, nil
}

// ─── 服务端指标（只读，仅 OPS）───

// GetMetrics 获取服务端进程内指标快照（GET /api/metrics，仅 OPS）：
// 计数器与按模式的队列深度。上游不可达或凭据权限不足时返回翻译后的错误。
func (s *MaintenanceService) GetMetrics(ctx context.Context) (models.MetricsSnapshot, error) {
	var empty models.MetricsSnapshot
	data, err := s.doMCARequest(ctx, http.MethodGet, "/api/metrics", nil, s.serviceToken())
	if err != nil {
		// The shared scope-error text is report-oriented; metrics need OPS too.
		if strings.Contains(err.Error(), "oauth_insufficient_scope") {
			return empty, fmt.Errorf("Server metrics require an OPS-level token (code oauth_insufficient_scope)")
		}
		return empty, err
	}

	var snapshot models.MetricsSnapshot
	if string(data) == "null" || len(data) == 0 {
		return models.MetricsSnapshot{
			Counters:   map[string]int64{},
			QueueDepth: map[string]int64{},
		}, nil
	}
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return empty, fmt.Errorf("failed to parse metrics snapshot: %w", err)
	}
	if snapshot.Counters == nil {
		snapshot.Counters = map[string]int64{}
	}
	if snapshot.QueueDepth == nil {
		snapshot.QueueDepth = map[string]int64{}
	}
	return snapshot, nil
}

// ─── 排行榜与玩家战绩（只读）───

// GetTopRankings 获取指定类型的 Top N 排行榜（当前赛季，赛季页面暂不做）。
func (s *MaintenanceService) GetTopRankings(ctx context.Context, rankType string, limit int) ([]models.Ranking, error) {
	if strings.TrimSpace(rankType) == "" {
		return nil, fmt.Errorf("rank_type must not be empty")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	path := fmt.Sprintf("/api/rankings/%s?limit=%d", rankType, limit)
	data, err := s.doMCARequest(ctx, http.MethodGet, path, nil, s.serviceToken())
	if err != nil {
		return nil, err
	}
	if string(data) == "null" || len(data) == 0 {
		return []models.Ranking{}, nil
	}

	var rankings []models.Ranking
	if err := json.Unmarshal(data, &rankings); err != nil {
		return nil, fmt.Errorf("failed to parse rankings: %w", err)
	}
	if rankings == nil {
		rankings = []models.Ranking{}
	}
	return rankings, nil
}

// GetPlayerHistory 按玩家 UID 查询历史战绩（经运维 SQL 联表，只读）。
// 服务端没有“按任意玩家查历史”的业务端点，这里复用既有的
// maintenance SQL 通道，与面板其余数据操作同一姿态。
func (s *MaintenanceService) GetPlayerHistory(ctx context.Context, uid int64, limit int) ([]models.PlayerMatchRow, error) {
	if uid == 0 {
		return nil, fmt.Errorf("uid must not be empty")
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	query := fmt.Sprintf(
		"SELECT m.id AS match_id, m.match_type, m.source, m.map_name, m.winner_team_id, "+
			"m.duration_seconds, m.started_at, m.finished_at, "+
			"p.team_id, p.is_winner, p.is_draw, p.rank_score_before, p.rank_score_delta "+
			"FROM match_participants p JOIN matches m ON m.id = p.match_id "+
			"WHERE p.user_uid = %d ORDER BY m.id DESC LIMIT %d",
		uid, limit,
	)

	data, err := s.executeSQL(ctx, query)
	if err != nil {
		return nil, err
	}
	if string(data) == "null" || len(data) == 0 {
		return []models.PlayerMatchRow{}, nil
	}

	// 运维 SQL 返回 []map[string]any：数字统一是 JSON number，
	// 先落到中间结构再转成强类型行。
	var rawRows []map[string]interface{}
	if err := json.Unmarshal(data, &rawRows); err != nil {
		return nil, fmt.Errorf("failed to parse history query result: %w", err)
	}

	rows := make([]models.PlayerMatchRow, 0, len(rawRows))
	for _, raw := range rawRows {
		rows = append(rows, models.PlayerMatchRow{
			MatchID:         int64(rawFloat(raw["match_id"])),
			MatchType:       rawString(raw["match_type"]),
			Source:          rawString(raw["source"]),
			MapName:         rawString(raw["map_name"]),
			WinnerTeamID:    rawString(raw["winner_team_id"]),
			DurationSeconds: int(rawFloat(raw["duration_seconds"])),
			StartedAt:       rawString(raw["started_at"]),
			FinishedAt:      rawString(raw["finished_at"]),
			TeamID:          rawString(raw["team_id"]),
			IsWinner:        int(rawFloat(raw["is_winner"])),
			IsDraw:          int(rawFloat(raw["is_draw"])),
			RankScoreBefore: int(rawFloat(raw["rank_score_before"])),
			RankScoreDelta:  int(rawFloat(raw["rank_score_delta"])),
		})
	}
	return rows, nil
}

// GetUpstreamStatus 探测上游 /api/status（公开端点，无需凭据）。
func (s *MaintenanceService) GetUpstreamStatus(ctx context.Context) models.UpstreamStatus {
	if s.cfg == nil || strings.TrimSpace(s.cfg.UpstreamURL) == "" {
		return models.UpstreamStatus{Reachable: false, Message: "upstream_url is not configured"}
	}

	url := strings.TrimSuffix(s.cfg.UpstreamURL, "/") + "/api/status"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return models.UpstreamStatus{Reachable: false, Message: err.Error()}
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return models.UpstreamStatus{Reachable: false, Message: "connection failed: " + err.Error()}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return models.UpstreamStatus{Reachable: false, Message: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}

	var envelope mcaSuccessEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return models.UpstreamStatus{Reachable: true, Message: "endpoint reachable but response is not parseable"}
	}

	var payload struct {
		Version string `json:"version"`
	}
	_ = json.Unmarshal(envelope.Data, &payload)
	return models.UpstreamStatus{Reachable: true, Version: payload.Version, Message: envelope.Message}
}

// rawFloat 从运维 SQL 的行 map 里安全取数字。
func rawFloat(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int64:
		return float64(n)
	case int:
		return float64(n)
	case json.Number:
		f, _ := n.Float64()
		return f
	default:
		return 0
	}
}

// rawString 从运维 SQL 的行 map 里安全取字符串（NULL → ""）。
func rawString(v interface{}) string {
	if str, ok := v.(string); ok {
		return str
	}
	return ""
}
