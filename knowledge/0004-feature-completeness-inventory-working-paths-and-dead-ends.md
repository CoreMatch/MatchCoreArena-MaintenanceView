# 0004. Completeness Inventory: Working Paths, Dead Ends, and a Broken Match-Upload INSERT

## Status
Accepted

## Date
2026-09-19

## Context
The tool grew feature-by-feature across a single day of commits, and some UI
surfaces predate the switch from direct storage access to the upstream SQL
endpoint (see entry 0002). Anyone operating this console needs an honest
inventory of which pages actually work and which are dead or broken, so this
entry records the state of the codebase as of HEAD
(b7430052b2dc95eb82885c61fafacf7207a14f13) without embellishment.

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
- Match Manager upload — the user-update statement is plausible; the follow-up
  `INSERT INTO matches` referenced a nonexistent `score_delta` column and
  omitted the NOT NULL `started_at`/`finished_at`, so it could not succeed
  against the baseline schema (the code comment itself only "assumed the
  matches table exists"). This INSERT was fixed on 2026-11-04 (commit
  e833eb9, see entry 0007): it now uses the real columns and sets both
  timestamps to `MatchTime`. Semantic gaps remain: the form collects
  `match_id`, `rank`, and `survivor_count`, which the backend ignores
  entirely, and `winner_uid` is written unconditionally regardless of
  `is_winner`.
- User list has a hard-coded `LIMIT 100` with no pagination, filtering, or
  search.

## Consequences
- Operators must know the Redis page and two of the three dashboard stats are
  decorative; the reliable numbers are Total Users and the user table itself.
- Manual match-result upload became executable on 2026-11-04 (e833eb9, see
  entry 0007); manual score correction through User Management remains the
  simpler fallback for fixing ratings.
- Costs and limitations:
  - The UI promises more than the backend delivers; nothing in the UI marks
    the dead surfaces as disabled.
  - This repo contains no tests at all (no `*_test.go`, no frontend tests),
    so schema drift like the broken INSERT is caught only at runtime.
  - The broken INSERT (fixed 2026-11-04) and the always-zero stats are/were
    silent failures: the tool reports success paths that depend on statements
    that never executed correctly.

## Evidence
- internal/logic/maintenance.go::GetRedisKeys — Redis methods hard-disabled
- internal/logic/maintenance.go::GetUsers — GetUsers with hard-coded LIMIT 100
- internal/logic/maintenance.go::GetSystemStats, internal/logic/maintenance.go::finished_at — stats queries; Redis-keys comment and active-matches query inside GetSystemStats
- internal/logic/maintenance.go::UploadMatchResult — UploadMatchResult; INSERT fixed on 2026-11-04 (commit e833eb9, see entry 0007); the pre-fix statement (internal/logic/maintenance.go:L184-L211 @ 167ddd72f878fefec5a597d787d67b2874b8fdd6) referenced a nonexistent `score_delta` column and omitted NOT NULL `started_at`/`finished_at`
- internal/models/models.go::MatchResult — MatchResult carries MatchID/Rank/SurvivorCount that the backend never uses
- frontend/src/components/RedisBrowser.tsx::GetRedisKeys — UI still calls the disabled backend
- frontend/src/components/Dashboard.tsx::redis_keys — three stat cards including always-zero Redis Keys
- frontend/src/components/MatchManager.tsx::match_id — form fields and submit path
- /home/lnb/Desktop/HA/MatchCoreArena-Server/migrate/migrations/baseline.sql::matches — matches schema: no `score_delta` column; `winner_uid`/`loser_uid` NOT NULL DEFAULT 0; `started_at`/`finished_at` NOT NULL without defaults — schema state since server commit eff1784 (2026-11-04)
- /home/lnb/Desktop/HA/MatchCoreArena-Server/migrate/migrations/baseline.sql::users — users schema (columns referenced by GetUsers do exist)
- commit b7430052b2dc95eb82885c61fafacf7207a14f13 — HEAD at the time of this inventory
- commit e833eb9 — 2026-11-04 fix of the upload INSERT (see entry 0007)
