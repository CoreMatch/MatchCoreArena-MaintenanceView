# 0002. All Maintenance Operations Tunnel Through Upstream POST /api/maintenance/sql

## Status
Accepted

## Date
2026-09-19

## Context
The tool must work from any network location that can reach the upstream, so
it cannot rely on direct access to the service's storage. All data operations
go through the upstream HTTP API, whose raw-SQL maintenance endpoint is
contract-defined in HA-Contract as `POST /api/maintenance/sql` requiring the
`maintenance` scope. The tool originally opened MySQL and Redis connections
directly; that design was abandoned in favor of the SQL tunnel, and the
direct-access clients are still constructed at startup but deliberately kept
unused — this is why the MySQL/Redis dependencies, the DSN/addr config
fields, and the idle client handles still exist.

## Decision
Every data operation is expressed as a raw SQL string POSTed to
`/api/maintenance/sql` with the management token (via the shared `executeSQL`
helper):

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
    errors.
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
