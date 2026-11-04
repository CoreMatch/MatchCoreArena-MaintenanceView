# 0002. All Maintenance Operations Tunnel Through Upstream POST /api/maintenance/sql

## Status
Accepted

## Date
2026-09-19

## Context
The first version of the tool opened MySQL and Redis connections directly,
assuming it would run on the same host as the service's storage. A later
refactor switched to the upstream HTTP API with token auth, but that left real
gaps: the user list was simulated from the public ranking API with UID set to
0, score updates were disabled, and system stats were placeholders. The server
subsequently exposed a raw-SQL maintenance endpoint, contract-defined in
HA-Contract as `POST /api/maintenance/sql` requiring the `maintenance` scope.

## Decision
Since commit d71ac1f, every data operation is expressed as a raw SQL string
POSTed to `/api/maintenance/sql` with the management token (via the shared
`executeSQL` helper):

- `GetUsers` — `SELECT uid, level, experience, rank_score, wins_count, created_at FROM users WHERE deleted_at IS NULL LIMIT 100`
- `UpdateUserRankScore` — `UPDATE users SET rank_score = ... WHERE uid = ...`
- `GetSystemStats` — two `COUNT(*)` queries (users, unfinished matches)
- `UploadMatchResult` — one `UPDATE users` plus one `INSERT INTO matches`

The local MySQL and Redis clients are still constructed at startup but are
deliberately unused (code comment: kept "in case they are needed later").
Direct Redis access is hard-disabled: `GetRedisKeys` and `DeleteRedisKey`
return errors unconditionally.

## Consequences
- The tool works from any network location that can reach the upstream and
  needs no storage credentials besides the management token; all writes pass a
  single, contract-defined choke point.
- Costs and limitations:
  - SQL strings are assembled with `fmt.Sprintf` rather than parameters (the
    endpoint accepts raw SQL anyway); schema drift surfaces only as runtime
    errors (see entry 0004 for a live example).
  - The server executes whatever SQL arrives (query first, exec as fallback);
    authorization is the only safeguard — there is no allow-listing or audit on
    either side.
  - The Redis Browser page and the Redis config block remain in the UI/config
    but are dead: every call errors out, and the dashboard "Redis Keys" stat is
    always 0.
  - The `go-sql-driver/mysql` and `go-redis` dependencies plus the DSN/addr
    config fields are vestigial.

## Evidence
- internal/logic/maintenance.go::NewMaintenanceService — db/redis clients initialized but unused (comment inside NewMaintenanceService)
- internal/logic/maintenance.go::executeSQL — `executeSQL` helper posting `{"sql": ...}` to `/api/maintenance/sql`
- internal/logic/maintenance.go::GetRedisKeys — Redis methods hard-disabled with error returns
- internal/logic/maintenance.go::GetUsers, internal/logic/maintenance.go::UpdateUserRankScore — GetUsers / UpdateUserRankScore SQL
- internal/logic/maintenance.go::GetSystemStats, internal/logic/maintenance.go::UploadMatchResult — GetSystemStats / UploadMatchResult SQL
- /home/lnb/Desktop/HA/HA-Contract/docs/api/openapi/matchcorearena-business.yaml (field: /api/maintenance/sql) — contract for `/api/maintenance/sql`
- /home/lnb/Desktop/HA/MatchCoreArena-Server/internal/service/maintenance.go::ExecuteSQL — server executes raw SQL (Query, fallback Exec)
- commit aa7f88ca711292bfdedc1e3082977b68388e63b3 — original direct MySQL/Redis implementation
- commit 00fb0523ae3b91379469bbc4f34c6728db03e876 — interim upstream-API version (ranking-API user list, disabled score updates)
- commit d71ac1f8152a98bad47278d8015b4e909710f325 — feat(maintenance): implement sql-based maintenance operations (also renamed `api_token` → `management_token`)
