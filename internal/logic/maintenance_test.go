// Tests for maintenance SQL proxy layer (internal/logic/maintenance.go).
// All upstream calls are mocked with httptest.Server against /api/maintenance/sql.
// No real DB / Redis / files touched here.

package logic

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"MCA-Maintenance/internal/models"
)

// ─── GetUsers（硬编码 LIMIT 100，knowledge 0004） ───

func TestGetUsers_OK(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/maintenance/sql" {
			t.Errorf("unexpected call: %s %s", r.Method, r.URL.Path)
		}
		// 检查 SQL 是硬编码的带 LIMIT 100 的语句
		body, _ := io.ReadAll(r.Body)
		var payload map[string]string
		if err := json.Unmarshal(body, &payload); err != nil {
			t.Fatalf("bad sql payload: %v", err)
		}
		sql := payload["sql"]
		if !strings.Contains(sql, "LIMIT 100") {
			t.Errorf("GetUsers SQL missing hard-coded LIMIT 100:\n  %s", sql)
		}
		if !strings.Contains(sql, "deleted_at IS NULL") {
			t.Errorf("GetUsers SQL should filter soft-deleted rows:\n  %s", sql)
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true,"data":[{"uid":1,"level":5,"experience":1200,"rank_score":1500,"wins_count":10,"created_at":"2024-01-01T00:00:00Z"}]}`))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	users, err := s.GetUsers(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 1 {
		t.Fatalf("expected 1 user, got %d", len(users))
	}
	u := users[0]
	if u.UID != 1 || u.Level != 5 || u.RankScore != 1500 || u.WinsCount != 10 {
		t.Errorf("user field mapping broken: %+v", u)
	}
}

func TestGetUsers_ServerError(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("boom"))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	_, err := s.GetUsers(context.Background())
	if err == nil {
		t.Fatal("expected server error, got nil")
	}
}

// ─── UpdateUserRankScore（GREATEST(0, ...) 下限保护，回归测试） ───

type sqlCaptureHandler struct {
	t    *testing.T
	SQLs []string
	resp []byte // 每次响应都返回相同的 data
	code int    // 状态码
}

func (h *sqlCaptureHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/api/maintenance/sql" {
		h.t.Errorf("unexpected call: %s %s", r.Method, r.URL.Path)
	}
	body, _ := io.ReadAll(r.Body)
	var payload map[string]string
	if err := json.Unmarshal(body, &payload); err != nil {
		h.t.Fatalf("bad sql payload: %v", err)
	}
	h.SQLs = append(h.SQLs, payload["sql"])

	w.Header().Set("Content-Type", "application/json")
	if h.code >= 400 {
		w.WriteHeader(h.code)
	}
	resp := h.resp
	if resp == nil {
		resp = []byte(`{"success":true,"data":null}`)
	}
	w.Write(resp)
}

func TestUpdateUserRankScore_GreatestZero(t *testing.T) {
	cap := &sqlCaptureHandler{t: t}
	ts := httptest.NewServer(cap)
	defer ts.Close()

	s := newTestService(t, ts.URL)

	// 正常正数
	if err := s.UpdateUserRankScore(context.Background(), 42, 2000); err != nil {
		t.Fatal(err)
	}
	if len(cap.SQLs) != 1 {
		t.Fatalf("expected 1 SQL, got %d", len(cap.SQLs))
	}
	sql := cap.SQLs[0]
	if !strings.Contains(sql, "GREATEST(0, 2000)") {
		t.Errorf("positive score: SQL should use GREATEST(0, ...) protection, got:\n  %s", sql)
	}
	if !strings.Contains(sql, "WHERE uid = 42") {
		t.Errorf("uid should be embedded in WHERE clause, got:\n  %s", sql)
	}

	// 负数 → GREATEST 保护应让 SQL 里的实际值被限制为 0
	cap.SQLs = nil
	if err := s.UpdateUserRankScore(context.Background(), 42, -500); err != nil {
		t.Fatal(err)
	}
	if len(cap.SQLs) != 1 {
		t.Fatalf("expected 1 SQL, got %d", len(cap.SQLs))
	}
	negSQL := cap.SQLs[0]
	// 注意：GREATEST(0, -500) 里的 -500 会被 GREATEST 裁为 0（这是 SQL 的行为，不是 Go 层先 clamp）。
	// 我们测的是 **SQL 字符串是否包含 GREATEST(0, ...)** —— 这是 Go 层的修复点。
	if !strings.Contains(negSQL, "GREATEST(0, -500)") {
		t.Errorf("negative score: SQL should still wrap in GREATEST(0, ...), got:\n  %s", negSQL)
	}
	// 关键回归断言：GREATEST 不应被漏掉（过去有直接 SET rank_score = score 的实现）
	if strings.Contains(negSQL, "SET rank_score = -500") {
		t.Errorf("REGRESSION: UpdateUserRankScore no longer uses GREATEST wrapper, got:\n  %s", negSQL)
	}

	// 分数 0 本身
	cap.SQLs = nil
	_ = s.UpdateUserRankScore(context.Background(), 1, 0)
	if !strings.Contains(cap.SQLs[0], "GREATEST(0, 0)") {
		t.Errorf("zero score should still be wrapped in GREATEST(0, ...), got:\n  %s", cap.SQLs[0])
	}
}

func TestUpdateUserRankScore_ServerError(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte("db down"))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	err := s.UpdateUserRankScore(context.Background(), 1, 100)
	if err == nil {
		t.Fatal("expected server error, got nil")
	}
}

// ─── UploadMatchResult ───

func TestUploadMatchResult_OK(t *testing.T) {
	cap := &sqlCaptureHandler{t: t}
	ts := httptest.NewServer(cap)
	defer ts.Close()

	s := newTestService(t, ts.URL)

	err := s.UploadMatchResult(context.Background(), models.MatchResult{
		UID:        42,
		IsWinner:   true,
		ScoreDelta: 50,
		MatchTime:  time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(cap.SQLs) != 2 {
		t.Fatalf("expected 2 SQLs (UPDATE users + INSERT matches), got %d", len(cap.SQLs))
	}

	updateSQL := cap.SQLs[0]
	// UPDATE 语句同样应有 GREATEST(0, rank_score + %d)
	if !strings.Contains(updateSQL, "GREATEST(0, rank_score + 50)") {
		t.Errorf("UPDATE should use GREATEST(0, rank_score + delta) — regression? got:\n  %s", updateSQL)
	}
	if !strings.Contains(updateSQL, "wins_count = wins_count + 1") {
		t.Errorf("UPDATE should bump wins_count when winner, got:\n  %s", updateSQL)
	}

	insertSQL := cap.SQLs[1]
	if !strings.Contains(insertSQL, "INSERT INTO matches") {
		t.Errorf("second SQL should be INSERT INTO matches, got:\n  %s", insertSQL)
	}
	if !strings.Contains(insertSQL, "'1v1'") {
		t.Errorf("hardcoded match_type should be 1v1, got:\n  %s", insertSQL)
	}
}

func TestUploadMatchResult_LoserDoesNotBumpWins(t *testing.T) {
	cap := &sqlCaptureHandler{t: t}
	ts := httptest.NewServer(cap)
	defer ts.Close()

	s := newTestService(t, ts.URL)
	err := s.UploadMatchResult(context.Background(), models.MatchResult{
		UID:        42,
		IsWinner:   false,
		ScoreDelta: -30,
		MatchTime:  time.Now().UTC(),
	})
	if err != nil {
		t.Fatal(err)
	}
	updateSQL := cap.SQLs[0]
	if strings.Contains(updateSQL, "wins_count = wins_count + 1") {
		t.Errorf("loser should NOT bump wins_count, got:\n  %s", updateSQL)
	}
	if !strings.Contains(updateSQL, "GREATEST(0, rank_score + -30)") {
		t.Errorf("loser UPDATE still needs GREATEST wrapper, got:\n  %s", updateSQL)
	}
}

// ─── GetSystemStats ───

func TestGetSystemStats_TotalUsers(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/maintenance/sql" {
			t.Errorf("unexpected call: %s %s", r.Method, r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		var payload map[string]string
		_ = json.Unmarshal(body, &payload)
		if !strings.Contains(payload["sql"], "SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL") {
			t.Errorf("unexpected stats SQL:\n  %s", payload["sql"])
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true,"data":[{"count":1234}]}`))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	stats, err := s.GetSystemStats(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if stats.TotalUsers != 1234 {
		t.Errorf("expected total_users=1234, got %d", stats.TotalUsers)
	}
}

func TestGetSystemStats_SQLFailureReturnsZero(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("db gone"))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	stats, err := s.GetSystemStats(context.Background())
	// GetSystemStats 吞掉 executeSQL 的错误（注释说明它对错误是尽力而为）
	if err != nil {
		t.Fatalf("GetSystemStats should not propagate internal SQL error: %v", err)
	}
	if stats.TotalUsers != 0 {
		t.Errorf("expected zero users on SQL failure, got %d", stats.TotalUsers)
	}
}

// ─── executeSQL / doRequest 底层错误 ───

func TestExecuteSQL_EnvelopeErrorPropagates(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"success":false,"code":"internal_error","message":"sql failed"}`))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	data, err := s.executeSQL(context.Background(), "SELECT 1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if data != nil {
		t.Errorf("expected nil data, got %s", data)
	}
}

func TestDoRequest_AuthorizationHeaderForManagementToken(t *testing.T) {
	var capturedAuth string
	handler := func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true,"data":null}`))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := &MaintenanceService{
		cfg:        &models.Config{UpstreamURL: ts.URL, ManagementToken: "mgmt-only-token"},
		httpClient: &http.Client{},
	}
	_, err := s.executeSQL(context.Background(), "SELECT 1")
	if err != nil {
		t.Fatal(err)
	}
	if capturedAuth != "Bearer mgmt-only-token" {
		t.Errorf("expected Bearer management_token header, got %q", capturedAuth)
	}
}

// ─── UploadMatchResult 中途失败的行为 ───

func TestUploadMatchResult_UpdateFailsInsertNotSent(t *testing.T) {
	callCount := 0
	handler := func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("locked"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"success":true,"data":null}`))
	}
	ts := httptest.NewServer(http.HandlerFunc(handler))
	defer ts.Close()

	s := newTestService(t, ts.URL)
	err := s.UploadMatchResult(context.Background(), models.MatchResult{
		UID:        42,
		IsWinner:   true,
		ScoreDelta: 50,
		MatchTime:  time.Now(),
	})
	if err == nil {
		t.Fatal("expected error from failing UPDATE")
	}
	if callCount != 1 {
		t.Errorf("expected UPDATE only (INSERT should not follow failed UPDATE), got %d calls", callCount)
	}
}
