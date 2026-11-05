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

- Dashboard — shows the configured upstream URL and real counts for Total
  Users and Active Matches via maintenance SQL (but see below for Active
  Matches).
- Database / User Management — lists the first 100 non-deleted users and can
  overwrite a user's `rank_score` (both via maintenance SQL; the users-table
  columns referenced match the server baseline schema).
- Rating Simulator — fully local computation, always available (entry 0003).
- Config Manager — edit/save/backup/history/restore of `config.yaml`
  (entry 0005).

Dead or broken paths:

- Redis Browser — the UI is intact (search, view, delete), but the backend
  returns "direct redis access is disabled" unconditionally.
- Dashboard "Redis Keys" stat — never populated by any code path; always 0.
- Dashboard "Active Matches" stat — computed as
  `SELECT COUNT(*) FROM matches WHERE finished_at IS NULL`, but the server
  baseline declares `finished_at TIMESTAMP NOT NULL`, so the count is
  structurally always 0.
- Match Manager upload — the user-update statement and the follow-up
  `INSERT INTO matches` both execute against the MatchCoreArena-Server
  baseline schema; entry 0007 records the INSERT's column choices and their
  rationale. Semantic gaps remain: the form collects `match_id`, `rank`, and
  `survivor_count`, which the backend ignores entirely, and `winner_uid` is
  written unconditionally regardless of `is_winner`.
- User list has a hard-coded `LIMIT 100` with no pagination, filtering, or
  search.

## Consequences
- Operators must know the Redis page and two of the three dashboard stats are
  decorative; the reliable numbers are Total Users and the user table itself.
- Manual match-result upload executes against the real schema (entry 0007);
  manual score correction through User Management remains the simpler
  fallback for fixing ratings.
- Costs and limitations:
  - The UI promises more than the backend delivers; nothing in the UI marks
    the dead surfaces as disabled.
  - This repo contains no tests at all (no `*_test.go`, no frontend tests),
    so schema drift is caught only at runtime.
  - The always-zero dashboard stats are silent failures: the UI shows numbers
    that no code path can ever make non-zero.

## Evidence
- internal/logic/maintenance.go::GetRedisKeys — Redis methods hard-disabled
- internal/logic/maintenance.go::GetUsers — GetUsers with hard-coded LIMIT 100
- internal/logic/maintenance.go::GetSystemStats, internal/logic/maintenance.go::finished_at — stats queries; Redis-keys comment and active-matches query inside GetSystemStats
- internal/logic/maintenance.go::UploadMatchResult — UploadMatchResult aligned with the baseline matches schema (entry 0007)
- internal/models/models.go::MatchResult — MatchResult carries MatchID/Rank/SurvivorCount that the backend never uses
- frontend/src/components/RedisBrowser.tsx::GetRedisKeys — UI still calls the disabled backend
- frontend/src/components/Dashboard.tsx::redis_keys — three stat cards including always-zero Redis Keys
- frontend/src/components/MatchManager.tsx::match_id — form fields and submit path
- /home/lnb/Desktop/HA/MatchCoreArena-Server/migrate/migrations/baseline.sql::matches — matches schema: no `score_delta` column; `winner_uid`/`loser_uid` NOT NULL DEFAULT 0; `started_at`/`finished_at` NOT NULL without defaults
- /home/lnb/Desktop/HA/MatchCoreArena-Server/migrate/migrations/baseline.sql::users — users schema (columns referenced by GetUsers do exist)
