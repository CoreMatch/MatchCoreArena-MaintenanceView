# 0004. Completeness Inventory: Working Paths and Dead Ends

## Status
Accepted

## Context
Anyone operating this console needs an honest inventory of which pages
actually work and which are dead or broken, so this entry records the
completeness state of the codebase without embellishment.

## Decision
Record the completeness state as implemented:

Working paths:

- Dashboard — shows the configured upstream URL, Total Users from
  maintenance SQL, and In Queue / Matches Reported from the OPS metrics proxy
  (`GET /api/metrics`, entry 0009). When metrics are unavailable the affected
  cards show "—" instead of a fabricated 0.
- Database / User Management — lists the first 100 non-deleted users and can
  overwrite a user's `rank_score` (both via maintenance SQL; the users-table
  columns referenced match the server baseline schema).
- Match Reporter — developer debug console over the business API: single and
  batch match feed through `POST /api/matches`, settlement display with
  rating before/delta/after, all proxied with backend-held tokens
  (entry 0008).
- Matchmaking — join/leave/status against the live matchmaking endpoints as
  the service-token identity (entry 0008).
- Rankings & History — read-only Top-N rankings and per-player history
  (history via maintenance SQL; entry 0008).
- Rating Simulator — fully local computation, always available (entry 0003).
- Config Manager — edit/save/backup/history/restore of `config.yaml`
  (entry 0005), including the `mca.reporter_token` field.

Dead or broken paths:

- Redis Browser — the UI is intact (search, view, delete), but the backend
  returns "direct redis access is disabled" unconditionally.
- Match Manager upload — the user-update statement and the follow-up
  `INSERT INTO matches` both execute against the MatchCoreArena-Server
  baseline schema; entry 0007 records the INSERT's column choices and their
  rationale. Semantic gaps remain: the form collects `match_id`, `rank`, and
  `survivor_count`, which the backend ignores entirely, and `winner_uid` is
  written unconditionally regardless of `is_winner`.
- User list has a hard-coded `LIMIT 100` with no pagination, filtering, or
  search.

## Consequences
- Operators must know the Redis page is decorative; the reliable numbers are
  Total Users, the user table itself, and the metrics-backed dashboard cards
  (In Queue / Matches Reported), which degrade to "—" when metrics fail rather
  than claiming zero.
- Manual match-result upload executes against the real schema (entry 0007);
  manual score correction through User Management remains the simpler
  fallback for fixing ratings.
- Costs and limitations:
  - The UI promises more than the backend delivers; nothing in the UI marks
    the dead surfaces as disabled.
  - This repo contains no tests at all (no `*_test.go`, no frontend tests),
    so schema drift is caught only at runtime.
  - Dashboard metric cards depend on a reachable upstream and an OPS-level
    token; without them the operator sees "—" plus a one-line hint, not data.

## Evidence
- (removed) former internal/logic/maintenance.go GetRedisKeys / DeleteRedisKey — hard-disabled first, then deleted entirely
- internal/logic/maintenance.go::GetUsers — GetUsers with hard-coded LIMIT 100
- internal/logic/maintenance.go::GetSystemStats — Total Users count via maintenance SQL (Active Matches / Redis Keys are no longer surfaced)
- internal/logic/mca.go::GetMetrics — OPS metrics proxy (`GET /api/metrics`) returning `MetricsSnapshot{counters, queue_depth}`
- app.go::GetMetrics — Wails binding for the metrics snapshot
- frontend/src/components/Dashboard.tsx::GetMetrics — In Queue = sum of `queue_depth`, Matches Reported = `counters["matches_reported_total"]`, "—" when unavailable
- frontend/src/i18n/index.ts::dashboard.metricsUnavailable — hint shown when metrics cannot be loaded
- internal/logic/maintenance.go::UploadMatchResult — UploadMatchResult aligned with the baseline matches schema (entry 0007)
- internal/models/models.go::MatchResult — MatchResult carries MatchID/Rank/SurvivorCount that the backend never uses
- (removed) former frontend/src/components/RedisBrowser.tsx — deleted together with the backend Redis methods; no Redis UI remains
- frontend/src/components/MatchManager.tsx::match_id — form fields and submit path
- /home/lnb/Desktop/HA/matchcore/MatchCoreArena-Server/migrate/migrations/baseline.sql::matches — matches schema: no `score_delta` column; `winner_uid`/`loser_uid` NOT NULL DEFAULT 0; `started_at`/`finished_at` NOT NULL without defaults
- /home/lnb/Desktop/HA/matchcore/MatchCoreArena-Server/migrate/migrations/baseline.sql::users — users schema (columns referenced by GetUsers do exist)
