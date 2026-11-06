# 0008. Match Operations Debug Console Proxies the MCA Business API with Backend-Held Tokens

## Status
Accepted

## Context
Operators and developers need a surface to feed test matches through the
real settlement path, exercise the matchmaking engine, and inspect rankings
and per-player history without touching player-facing clients. The console
already tunnels data operations through the upstream maintenance endpoint
(entry 0002); this entry records how the match-operations pages fit in.

## Decision

- The console is a developer debug surface for the live business API. Match
  feed (single and batch) calls the one and only match entry point
  `POST /api/matches` in a loop; there is no separate "virtual match"
  concept, endpoint, or form semantics in this tool.
- Credentials stay in the Go backend. `config.yaml` gains an `mca` section:
  `mca.reporter_token` may hold an OPS-grade service token (server-side
  `tokens.yaml` entries carrying `match:report`); when empty the proxy falls
  back to `management_token` (the `maintenance` scope implies all scopes
  server-side). The frontend never receives or sends any token; it only
  calls bound Go methods.
- Page inventory:
  - Match Reporter — single-match form shaped exactly like the contract's
    `TeamReportInput` (winner team + loser teams, per-member uuid /
    survival / kills / deaths / perf_tweak), plus a batch box accepting a
    `TeamReportInput` JSON object or array, submitted sequentially. Empty
    `started_at`/`finished_at` are filled with the current RFC3339 time
    because the endpoint requires both. After a successful report the console
    fetches `GET /api/matches/{id}` to show each participant's rating
    before/delta/after (`after` rendered as `max(0, before+delta)`, the
    server's floor). Field-level validation blocks submission before it
    happens: match-type shape, RFC3339 timestamps and their ordering,
    duration-vs-timestamps consistency, UUID presence/format, perf_tweak
    range [0.95, 1.05], and count-vs-result contradictions (alive vs
    initial, winner survivors, members vs initial_count); every message is
    readable English from the i18n dictionary. The batch feed shows live
    progress ("Reporting 3/10…"), a final "N reported · M failed" summary,
    per-item failure reasons, and a View action per recorded match that
    loads its settlement detail. Success exits always carry the match ID.
  - Matchmaking — join/leave/status against `/api/matchmaking/*`, acting as
    whichever UID the configured service token resolves to (management token
    → UID -1). This is intentional for engine debugging, not player
    impersonation. The queue status card polls the status endpoint every 5 s
    and renders a live waiting timer from `enqueued_at`. Party fields
    (member UUID list) are reserved at the team dimension while server-side
    party matchmaking lands: non-empty lists are sent as `party_members` in
    the join body, which the current server ignores (field name pending the
    server contract; see the workspace PENDING-DECISIONS).
  - Rankings & History — read-only. Top-N via `GET /api/rankings/{type}`
    (current season only; no season page). Per-player history has no
    business endpoint for arbitrary players, so it reuses the maintenance SQL
    tunnel (entry 0002) with a `match_participants JOIN matches` query.
- OPS identity visibility: the reporter header shows a credential chip
  (reporter configured / using management token / not configured) from
  `GetOpsIdentity`, which returns only boolean state and the upstream URL —
  never token material. Auth failures translate to "Reporting requires an
  OPS token with the match:report scope." and connection failures to
  "Backend unreachable: {url}".
- Request log: the proxy layer keeps an in-memory ring buffer (last 50) of
  every tunneled call — time, method, path, HTTP status, typed error code —
  exposed read-only as `GetRequestLog` and rendered on the Match Reporter
  page ("Request log" / "No requests yet."). It is deliberately not
  persisted: it debugs the running session, not history.
- Upstream typed error envelopes (`success:false` + `code`) are translated
  into readable English messages (English-first UI direction; UI copy is
  centralized in `frontend/src/i18n/`) that still carry the original code and
  HTTP status, e.g. `mca_user_not_found`, `mca_user_not_provisioned`,
  `oauth_insufficient_scope`, `mca_queue_already_joined`.
- Rating parameters (Elo weights, K-factor) are not exposed or adjustable
  here; the console only displays settlement results (entry 0003 remains the
  only what-if surface).

## Consequences
- Test matches settle through the exact production code path, including
  HRPAuth identity resolution; participant UUIDs must exist in HRPAuth or the
  report fails with a translated `mca_user_not_found`.
- Matchmaking actions write queue rows under the service identity; operators
  must expect a queue entry for UID -1 (or the reporter token's UID) while
  debugging.
- Costs and limitations:
  - Batch feed is sequential with no retry/rollback; a failing item does not
    stop the rest, and already-recorded matches are never undone.
  - Player history via raw SQL bypasses any future business-level access
    rules the server might add for history reads.

## Evidence
- internal/logic/mca.go::ReportMatch — single report against `POST /api/matches` with `serviceToken()`
- internal/logic/mca.go::serviceToken — reporter_token with management_token fallback
- internal/logic/mca.go::translateMCAError — typed envelope translation table
- internal/logic/mca.go::GetPlayerHistory — history through the maintenance SQL tunnel
- internal/logic/mca.go::recordRequest — request-log ring buffer feed
- internal/logic/mca.go::GetOpsIdentity — credential state without token material
- internal/logic/mca.go::party_members — reserved party field in the join body
- internal/models/models.go::MCAConfig — `mca.reporter_token` config field
- internal/models/models.go::RequestLogEntry — request-log record shape
- config.yaml (field: mca) — OPS credential section in the committed config
- app.go::ReportMatch — bound methods for the three pages
- frontend/src/components/MatchReporter.tsx::validateReport — field-level validation blocking submission
- frontend/src/components/MatchReporter.tsx::submitBatch — batch feed with progress, summary, and per-item View
- frontend/src/components/MatchmakingPanel.tsx::waitingFor — polled queue status card with live waiting timer
- frontend/src/components/RankingsView.tsx::loadRankings — read-only rankings and history
- frontend/src/i18n/index.ts::validation.matchType — English-first centralized copy dictionary
- /home/lnb/Desktop/HA/MatchCoreArena-Server/api/handler/match.go::Report — `match:report` scope gate on the endpoint
- /home/lnb/Desktop/HA/MatchCoreArena-Server/api/middleware/auth.go::HasScope — maintenance scope implies match:report
