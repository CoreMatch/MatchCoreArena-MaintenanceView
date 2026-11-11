// Tests for MCA business API proxy layer (internal/logic/mca.go).
// All upstream calls are mocked with httptest.Server; no real DB, no real
// MCA server, no real tokens ever appear here.

package logic

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"MCA-Maintenance/internal/models"
)

// newTestService 构造一个直接指向 httptest.Server 的 MaintenanceService。
// 跳过 NewMaintenanceService 的 MySQL/Redis 初始化（本包测试不连这些）。
func newTestService(t *testing.T, serverURL string) *MaintenanceService {
	t.Helper()
	return &MaintenanceService{
		cfg:        &models.Config{UpstreamURL: serverURL},
		httpClient: &http.Client{},
	}
}

// envel 构造上游成功信封。
func envel(data any) []byte {
	body := map[string]any{"success": true, "message": "ok", "data": data}
	out, _ := json.Marshal(body)
	return out
}

// envelErr 构造上游错误信封。
func envelErr(status int, code, msg string) []byte {
	out, _ := json.Marshal(map[string]any{
		"success": false, "code": code, "message": msg,
	})
	return out
}

// ─── translateMCAError / parseMCAErrorCode 直接单元测试 ───

func TestParseMCAErrorCode(t *testing.T) {
	if code := parseMCAErrorCode([]byte(`{"success":false,"code":"oauth_insufficient_scope","message":"oops"}`)); code != "oauth_insufficient_scope" {
		t.Errorf("expected oauth_insufficient_scope, got %q", code)
	}
	if code := parseMCAErrorCode([]byte(`not json`)); code != "" {
		t.Errorf("expected empty on parse failure, got %q", code)
	}
	if code := parseMCAErrorCode([]byte(`{"success":false,"message":"no code field"}`)); code != "" {
		t.Errorf("expected empty when code missing, got %q", code)
	}
}

func TestTranslateMCAError_KnownCode(t *testing.T) {
	err := translateMCAError(403, envelErr(403, "oauth_insufficient_scope", ""))
	msg := err.Error()
	if !strings.Contains(msg, "match:report scope") {
		t.Errorf("expected translated hint about match:report scope, got: %v", msg)
	}
}

func TestTranslateMCAError_UnknownCode(t *testing.T) {
	// 未知 code → 回落到 envelope.message
	err := translateMCAError(500, envelErr(500, "weird_new_code", "server went boom"))
	if !strings.Contains(err.Error(), "server went boom") {
		t.Errorf("expected envelope message fallback, got: %v", err)
	}
}

func TestTranslateMCAError_InvalidJSON(t *testing.T) {
	err := translateMCAError(503, []byte("backend down"))
	if !strings.Contains(err.Error(), "HTTP 503") || !strings.Contains(err.Error(), "backend down") {
		t.Errorf("expected status+body fallback, got: %v", err)
	}
}

// ─── doMCARequest 基础路径 ───

func TestDoMCARequest_MissingUpstreamURL(t *testing.T) {
	s := &MaintenanceService{cfg: &models.Config{}, httpClient: &http.Client{}}
	_, err := s.doMCARequest(context.Background(), "GET", "/api/metrics", nil, "")
	if err == nil || !strings.Contains(err.Error(), "upstream_url is not configured") {
		t.Errorf("expected missing upstream error, got: %v", err)
	}
}

func TestServiceToken_PreferenceOrder(t *testing.T) {
	s := &MaintenanceService{
		cfg: &models.Config{
			ManagementToken: "mgmt-token",
			MCA:             models.MCAConfig{ReporterToken: "reporter-token"},
		},
	}
	if got := s.serviceToken(); got != "reporter-token" {
		t.Errorf("expected reporter_token to take precedence, got %q", got)
	}
	s.cfg.MCA.ReporterToken = ""
	if got := s.serviceToken(); got != "mgmt-token" {
		t.Errorf("expected fallback to management_token, got %q", got)
	}
	s.cfg = nil
	if got := s.serviceToken(); got != "" {
		t.Errorf("expected empty when cfg nil, got %q", got)
	}
}

// ─── GetMetrics ───

func TestGetMetrics_OK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/api/metrics" {
			t.Errorf("unexpected call: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel(map[string]any{
			"counters":   map[string]int64{"match_report_total": 42},
			"queue_depth": map[string]int64{"1v1": 3, "2v2": 7},
		}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	m, err := s.GetMetrics(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.Counters["match_report_total"] != 42 {
		t.Errorf("counters mismatch: %v", m.Counters)
	}
	if m.QueueDepth["1v1"] != 3 || m.QueueDepth["2v2"] != 7 {
		t.Errorf("queue_depth mismatch: %v", m.QueueDepth)
	}
}

func TestGetMetrics_EmptyDataReturned(t *testing.T) {
	// 上游 data=null（或空）时应返回非 nil 的空 map，避免前端 nil deref
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true,"message":"ok","data":null}`))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	m, err := s.GetMetrics(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.Counters == nil || m.QueueDepth == nil {
		t.Errorf("expected initialized maps, got counters=%v queue_depth=%v", m.Counters, m.QueueDepth)
	}
}

func TestGetMetrics_ScopeError_RewritesHint(t *testing.T) {
	// 上游返回 403 oauth_insufficient_scope —— metrics 需要 OPS，代理层重写提示
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelErr(403, "oauth_insufficient_scope", "insufficient scope"))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	_, err := s.GetMetrics(context.Background())
	if err == nil {
		t.Fatal("expected scope error, got nil")
	}
	// 代理层应改写为带 "OPS-level token" 的提示
	if !strings.Contains(err.Error(), "OPS-level token") {
		t.Errorf("expected rewritten hint about OPS token, got: %v", err)
	}
}

func TestGetMetrics_UpstreamUnreachable(t *testing.T) {
	// 指向一个关闭后的 server → 连接失败
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	ts.Close()

	s := newTestService(t, ts.URL)
	_, err := s.GetMetrics(context.Background())
	if err == nil {
		t.Fatal("expected connection error, got nil")
	}
}

// ─── ReportMatch ───

func TestReportMatch_OK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/matches" {
			t.Errorf("unexpected call: %s %s", r.Method, r.URL.Path)
		}
		// 确认请求体是合法 TeamReportInput
		body, _ := io.ReadAll(r.Body)
		var input models.TeamReportInput
		if err := json.Unmarshal(body, &input); err != nil {
			t.Errorf("body not TeamReportInput: %v\nbody: %s", err, body)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel(map[string]any{
			"id": 1, "match_type": "1v1", "source": "virtual",
			"winner_team_id": "t1", "game_id": "abc-123",
			"started_at": "2024-01-01T00:00:00Z",
			"finished_at": "2024-01-01T00:10:00Z",
		}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	match, err := s.ReportMatch(context.Background(), models.TeamReportInput{
		MatchType: "1v1",
		WinnerTeam: models.TeamReportInfo{
			TeamID: "t1",
			Members: []models.ParticipantReport{{UUID: "a"}},
		},
		LoserTeams: []models.TeamReportInfo{
			{TeamID: "t2", Members: []models.ParticipantReport{{UUID: "b"}}},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if match.ID != 1 || match.GameID != "abc-123" {
		t.Errorf("match mismatch: %+v", match)
	}
}

func TestReportMatch_ValidationFail(t *testing.T) {
	s := &MaintenanceService{cfg: &models.Config{}, httpClient: &http.Client{}}
	// 空 match_type
	_, err := s.ReportMatch(context.Background(), models.TeamReportInput{MatchType: "", WinnerTeam: models.TeamReportInfo{Members: []models.ParticipantReport{{UUID: "a"}}}, LoserTeams: []models.TeamReportInfo{{}}})
	if err == nil || !strings.Contains(err.Error(), "match_type") {
		t.Errorf("expected match_type validation error, got: %v", err)
	}
	// 空 winner members
	_, err = s.ReportMatch(context.Background(), models.TeamReportInput{MatchType: "1v1", WinnerTeam: models.TeamReportInfo{Members: nil}, LoserTeams: []models.TeamReportInfo{{}}})
	if err == nil || !strings.Contains(err.Error(), "winner team") {
		t.Errorf("expected winner team validation error, got: %v", err)
	}
	// 空 loser teams
	_, err = s.ReportMatch(context.Background(), models.TeamReportInput{MatchType: "1v1", WinnerTeam: models.TeamReportInfo{Members: []models.ParticipantReport{{UUID: "a"}}}, LoserTeams: nil})
	if err == nil || !strings.Contains(err.Error(), "loser team") {
		t.Errorf("expected loser teams validation error, got: %v", err)
	}
}

func TestReportMatch_ScopeRejected(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelErr(403, "oauth_insufficient_scope", "need match:report"))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	_, err := s.ReportMatch(context.Background(), models.TeamReportInput{
		MatchType:  "1v1",
		WinnerTeam: models.TeamReportInfo{TeamID: "t1", Members: []models.ParticipantReport{{UUID: "a"}}},
		LoserTeams: []models.TeamReportInfo{{TeamID: "t2", Members: []models.ParticipantReport{{UUID: "b"}}}},
	})
	if err == nil {
		t.Fatal("expected scope rejection, got nil")
	}
	// translateMCAError 应返回包含 match:report scope 提示
	if !strings.Contains(err.Error(), "match:report") {
		t.Errorf("expected translated scope hint, got: %v", err)
	}
}

func TestReportMatch_PayloadHashConflict(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusConflict)
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelErr(409, "mca_game_id_conflict", "game_id already recorded"))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	_, err := s.ReportMatch(context.Background(), models.TeamReportInput{
		MatchType:  "1v1",
		WinnerTeam: models.TeamReportInfo{TeamID: "t1", Members: []models.ParticipantReport{{UUID: "a"}}},
		LoserTeams: []models.TeamReportInfo{{TeamID: "t2", Members: []models.ParticipantReport{{UUID: "b"}}}},
	})
	if err == nil {
		t.Fatal("expected conflict error, got nil")
	}
	if !strings.Contains(err.Error(), "idempotency conflict") {
		t.Errorf("expected idempotency-conflict hint, got: %v", err)
	}
}

// ─── Join / Leave / Status ───

func TestJoinMatchmaking_OK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/matchmaking/join" {
			t.Errorf("unexpected call: %s %s", r.Method, r.URL.Path)
		}
		// 检查 Authorization 头
		auth := r.Header.Get("Authorization")
		if auth != "Bearer reporter-xyz" {
			t.Errorf("expected Bearer token header, got %q", auth)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel(map[string]any{
			"uid": 123, "match_type": "1v1", "rank_score": 1500,
			"enqueued_at": "2024-01-01T00:00:00Z",
		}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := &MaintenanceService{
		cfg:        &models.Config{UpstreamURL: ts.URL, MCA: models.MCAConfig{ReporterToken: "reporter-xyz"}},
		httpClient: &http.Client{},
	}
	entry, err := s.JoinMatchmaking(context.Background(), "1v1", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if entry.UID != 123 || entry.RankScore != 1500 {
		t.Errorf("queue entry mismatch: %+v", entry)
	}
}

func TestJoinMatchmaking_QueueAlreadyJoined(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusConflict)
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelErr(409, "mca_queue_already_joined", "already in queue"))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	_, err := s.JoinMatchmaking(context.Background(), "1v1", nil)
	if err == nil {
		t.Fatal("expected queue-already-joined error")
	}
	if !strings.Contains(err.Error(), "already") { // 映射的 message 里有 "one entry per identity" 或原文
		t.Errorf("expected translated already-in-queue hint, got: %v", err)
	}
}

func TestLeaveMatchmaking_OK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete || r.URL.Path != "/api/matchmaking/leave" {
			t.Errorf("unexpected call: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel(map[string]any{}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	if err := s.LeaveMatchmaking(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLeaveMatchmaking_NotJoined(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Header().Set("Content-Type", "application/json")
		w.Write(envelErr(404, "mca_queue_not_joined", "not in queue"))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	err := s.LeaveMatchmaking(context.Background())
	if err == nil {
		t.Fatal("expected not-joined error")
	}
	if !strings.Contains(err.Error(), "not") { // translated message
		t.Errorf("expected translated not-in-queue hint, got: %v", err)
	}
}

func TestGetMatchmakingStatus_OK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/api/matchmaking/status" {
			t.Errorf("unexpected call: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel(map[string]any{
			"in_queue":      true,
			"queue_entry":   map[string]any{"uid": 123, "match_type": "1v1", "rank_score": 1500, "enqueued_at": "t0"},
			"recent_groups": []map[string]any{
				{"group_id": 1, "match_type": "1v1", "formed_at": "t1", "members": []any{map[string]any{"uid": 123}}, "room": "bw-room-1"},
			},
		}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	st, err := s.GetMatchmakingStatus(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !st.InQueue {
		t.Error("expected in_queue=true")
	}
	if len(st.RecentGroups) != 1 {
		t.Errorf("expected 1 recent group, got %d", len(st.RecentGroups))
	}
	if st.RecentGroups[0].Room != "bw-room-1" {
		t.Errorf("expected room bw-room-1, got %q", st.RecentGroups[0].Room)
	}
}

// ─── GetMatchRejections ───

func TestGetMatchRejections_ParseOK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/api/matches/rejections" {
			t.Errorf("unexpected call: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel([]map[string]any{
			{"time": "12:00:01", "code": "mca_report_inconsistent", "game_id": "g1", "reason": "bad"},
			{"time": "12:00:02", "code": "mca_match_not_found", "game_id": "g2", "reason": "nope"},
		}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	recs, err := s.GetMatchRejections(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(recs) != 2 {
		t.Fatalf("expected 2 records, got %d", len(recs))
	}
	if recs[0].Code != "mca_report_inconsistent" || recs[1].GameID != "g2" {
		t.Errorf("rejection records mismatch: %+v", recs)
	}
}

func TestGetMatchRejections_EmptyData(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel(nil))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	recs, err := s.GetMatchRejections(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if recs == nil {
		t.Error("expected non-nil empty slice")
	}
}

// ─── ListMatches / GetMatchByGameID / GetMatchByID ───

func TestListMatches_PaginationNormalization(t *testing.T) {
	var recordedQuery string
	handler := func(w http.ResponseWriter, r *http.Request) {
		recordedQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel([]map[string]any{}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)

	// 默认分页：page_num=1, page_size=20
	_, err := s.ListMatches(context.Background(), models.MatchListQuery{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(recordedQuery, "page_num=1") || !strings.Contains(recordedQuery, "page_size=20") {
		t.Errorf("expected default pagination in query, got %q", recordedQuery)
	}

	// page_size=0 → 还是 20
	_, _ = s.ListMatches(context.Background(), models.MatchListQuery{PageSize: 0})
	if !strings.Contains(recordedQuery, "page_size=20") {
		t.Errorf("page_size=0 should normalize to 20, got %q", recordedQuery)
	}

	// page_size=200 → 被夹到 20（因为 >100 的上限处理走同一分支）
	_, _ = s.ListMatches(context.Background(), models.MatchListQuery{PageSize: 200})
	if !strings.Contains(recordedQuery, "page_size=20") {
		t.Errorf("page_size=200 should clamp to 20, got %q", recordedQuery)
	}
}

func TestListMatches_FiltersForwarded(t *testing.T) {
	var recordedQuery string
	handler := func(w http.ResponseWriter, r *http.Request) {
		recordedQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel([]map[string]any{}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	_, err := s.ListMatches(context.Background(), models.MatchListQuery{
		Source: "game", MapName: "hub", GameID: "abc", UID: 42,
		FinishedFrom: "2024-01-01", FinishedTo: "2024-02-01",
	})
	if err != nil {
		t.Fatal(err)
	}
	required := []string{"source=game", "map_name=hub", "game_id=abc", "uid=42", "finished_from=2024-01-01", "finished_to=2024-02-01"}
	for _, r := range required {
		if !strings.Contains(recordedQuery, r) {
			t.Errorf("expected query param %q in %q", r, recordedQuery)
		}
	}
}

func TestGetMatchByID_OK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/api/matches/99" {
			t.Errorf("unexpected call: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel(map[string]any{"id": 99, "match_type": "1v1", "game_id": "xyz"}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	m, err := s.GetMatchByID(context.Background(), 99)
	if err != nil {
		t.Fatal(err)
	}
	if m.ID != 99 {
		t.Errorf("expected id=99, got %+v", m)
	}
}

func TestGetMatchByGameID_OK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/matches/by-game-id/") {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel(map[string]any{"id": 1, "game_id": "g-1"}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	m, err := s.GetMatchByGameID(context.Background(), "g-1")
	if err != nil {
		t.Fatal(err)
	}
	if m.GameID != "g-1" {
		t.Errorf("expected game_id=g-1, got %+v", m)
	}
}

func TestGetMatchByGameID_EmptyInput(t *testing.T) {
	s := &MaintenanceService{cfg: &models.Config{}, httpClient: &http.Client{}}
	_, err := s.GetMatchByGameID(context.Background(), "   ")
	if err == nil || !strings.Contains(err.Error(), "game_id") {
		t.Errorf("expected game_id validation error, got: %v", err)
	}
}

// ─── GetTopRankings ───

func TestGetTopRankings_LimitNormalization(t *testing.T) {
	var recordedQuery string
	handler := func(w http.ResponseWriter, r *http.Request) {
		recordedQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel([]map[string]any{}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)

	_, _ = s.GetTopRankings(context.Background(), "1v1", 0)
	if !strings.Contains(recordedQuery, "limit=100") {
		t.Errorf("limit=0 should normalize to 100, got %q", recordedQuery)
	}

	_, _ = s.GetTopRankings(context.Background(), "1v1", 1000)
	if !strings.Contains(recordedQuery, "limit=100") {
		t.Errorf("limit=1000 should clamp to 100, got %q", recordedQuery)
	}
}

func TestGetTopRankings_InvalidRankType(t *testing.T) {
	s := &MaintenanceService{cfg: &models.Config{}, httpClient: &http.Client{}}
	_, err := s.GetTopRankings(context.Background(), "   ", 10)
	if err == nil || !strings.Contains(err.Error(), "rank_type") {
		t.Errorf("expected rank_type validation error, got: %v", err)
	}
}

// ─── GetUpstreamStatus ───

func TestGetUpstreamStatus_OK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/status" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(envel(map[string]any{"version": "1.2.3"}))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	st := s.GetUpstreamStatus(context.Background())
	if !st.Reachable {
		t.Error("expected reachable=true")
	}
	if st.Version != "1.2.3" {
		t.Errorf("expected version 1.2.3, got %q", st.Version)
	}
}

func TestGetUpstreamStatus_HTTPError(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	st := s.GetUpstreamStatus(context.Background())
	if st.Reachable {
		t.Error("expected reachable=false on 500")
	}
	if !strings.Contains(st.Message, "HTTP 500") {
		t.Errorf("expected status text containing HTTP 500, got %q", st.Message)
	}
}

func TestGetUpstreamStatus_NoConfig(t *testing.T) {
	s := &MaintenanceService{cfg: nil, httpClient: &http.Client{}}
	st := s.GetUpstreamStatus(context.Background())
	if st.Reachable {
		t.Error("expected reachable=false with nil config")
	}
}

// ─── 代理层请求日志环形缓冲 ───

func TestRecordRequest_RingBufferCapsAt50(t *testing.T) {
	s := &MaintenanceService{cfg: &models.Config{}, httpClient: &http.Client{}}
	// 推入超过 requestLogCap (50) 条
	for i := 0; i < requestLogCap+20; i++ {
		s.recordRequest("GET", fmt.Sprintf("/x/%d", i), 200, "", true)
	}
	if len(s.reqLog) != requestLogCap {
		t.Errorf("ring buffer capped at %d, got len=%d", requestLogCap, len(s.reqLog))
	}
	// 最新的一条应该是 /x/69
	entries := s.GetRequestLog()
	if len(entries) != requestLogCap {
		t.Errorf("GetRequestLog() len mismatch: %d", len(entries))
	}
	if entries[0].Path != "/x/69" {
		t.Errorf("latest entry should be /x/69, got %+v", entries[0])
	}
	// 最早的一条应该是 /x/20（因为从 0 开始推，超出的 20 条截掉，保留索引 20-69）
	if entries[len(entries)-1].Path != "/x/20" {
		t.Errorf("oldest entry should be /x/20, got %+v", entries[len(entries)-1])
	}
}

// ─── rawFloat / rawString（运维 SQL 解析辅助） ───

func TestRawFloat_AllNumericTypes(t *testing.T) {
	cases := []struct {
		in   any
		want float64
	}{
		{float64(3.14), 3.14},
		{int64(42), 42},
		{int(7), 7},
		{json.Number("99"), 99},
		{"nope", 0},
		{nil, 0},
	}
	for _, c := range cases {
		if got := rawFloat(c.in); got != c.want {
			t.Errorf("rawFloat(%v) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestRawString_HandlingNull(t *testing.T) {
	if got := rawString("hello"); got != "hello" {
		t.Errorf("expected 'hello', got %q", got)
	}
	if got := rawString(nil); got != "" {
		t.Errorf("nil → empty, got %q", got)
	}
	if got := rawString(123); got != "" {
		t.Errorf("non-string → empty, got %q", got)
	}
}

// ─── GetPlayerHistory（通过维护 SQL 联表查询） ───

func TestGetPlayerHistory_OK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/maintenance/sql" {
			t.Errorf("GetPlayerHistory should route through maintenance SQL: %s %s", r.Method, r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		var payload map[string]string
		_ = json.Unmarshal(body, &payload)
		if !strings.Contains(payload["sql"], "match_participants") || !strings.Contains(payload["sql"], "JOIN matches") {
			t.Errorf("unexpected history SQL:\n  %s", payload["sql"])
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true,"data":[
			{"match_id":42,"match_type":"1v1","source":"game","map_name":"hub",
			 "winner_team_id":"t1","duration_seconds":600,
			 "started_at":"t0","finished_at":"t1","team_id":"t2",
			 "is_winner":0,"is_draw":0,"rank_score_before":1500,"rank_score_delta":-25}
		]}`))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	rows, err := s.GetPlayerHistory(context.Background(), 123, 50)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(rows))
	}
	row := rows[0]
	if row.MatchID != 42 || row.RankScoreBefore != 1500 || row.RankScoreDelta != -25 || row.IsWinner != 0 {
		t.Errorf("field mapping broken: %+v", row)
	}
}

func TestGetPlayerHistory_Validation(t *testing.T) {
	s := &MaintenanceService{cfg: &models.Config{}, httpClient: &http.Client{}}
	// uid=0 被拒
	_, err := s.GetPlayerHistory(context.Background(), 0, 10)
	if err == nil || !strings.Contains(err.Error(), "uid") {
		t.Errorf("expected uid validation, got: %v", err)
	}
	// limit=0 → 默认 50
	var capturedSQL string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var payload map[string]string
		_ = json.Unmarshal(body, &payload)
		capturedSQL = payload["sql"]
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true,"data":[]}`))
	}))
	defer ts.Close()
	s2 := newTestService(t, ts.URL)
	_, _ = s2.GetPlayerHistory(context.Background(), 123, 0)
	if !strings.Contains(capturedSQL, "LIMIT 50") {
		t.Errorf("limit=0 should normalize to 50, got SQL:\n  %s", capturedSQL)
	}
	// limit=300 → clamp 到 50
	capturedSQL = ""
	_, _ = s2.GetPlayerHistory(context.Background(), 123, 300)
	if !strings.Contains(capturedSQL, "LIMIT 50") {
		t.Errorf("limit=300 should clamp to 50, got SQL:\n  %s", capturedSQL)
	}
}

// ─── GetOpsIdentity ───

func TestGetOpsIdentity_BothTokensConfigured(t *testing.T) {
	s := &MaintenanceService{
		cfg: &models.Config{
			UpstreamURL:     "https://example.com/",
			ManagementToken: "any",
			MCA:             models.MCAConfig{ReporterToken: "any"},
		},
	}
	id := s.GetOpsIdentity()
	if !id.ReporterConfigured {
		t.Error("expected ReporterConfigured=true")
	}
	if id.UsingFallback {
		t.Error("should NOT use fallback when reporter_token present")
	}
	if id.UpstreamURL != "https://example.com/" {
		t.Errorf("upstream url mismatch: %q", id.UpstreamURL)
	}
}

func TestGetOpsIdentity_FallbackToManagement(t *testing.T) {
	s := &MaintenanceService{
		cfg: &models.Config{
			UpstreamURL:     "https://example.com/",
			ManagementToken: "mgmt",
			MCA:             models.MCAConfig{ReporterToken: ""},
		},
	}
	id := s.GetOpsIdentity()
	if id.ReporterConfigured {
		t.Error("expected ReporterConfigured=false when reporter_token empty")
	}
	if !id.UsingFallback {
		t.Error("expected UsingFallback=true")
	}
}

func TestGetOpsIdentity_NilConfig(t *testing.T) {
	s := &MaintenanceService{cfg: nil}
	id := s.GetOpsIdentity()
	if id.ReporterConfigured || id.UsingFallback || id.UpstreamURL != "" {
		t.Errorf("nil config should yield zero-value OpsIdentity, got %+v", id)
	}
}
