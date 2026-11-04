# 0007. Cleanup Pass Checklist: Fixed Items and Pending Decisions

## Status
Accepted

## Date
2026-11-04 (cleanup commits listed in Evidence)

## Context
Per the author's 2026-11 instruction, the three MatchCoreArena repositories had
drifted and needed a low-risk cleanup pass: fix only items with a single correct
answer (statements that can never execute, doc-vs-code mismatches), and defer
everything that requires a design decision. This entry is the checklist for this
repository.

## Decision

### Fixed in this pass

1. Manual match upload INSERT aligned with the real schema (commit
   `e833eb9`): `UploadMatchResult` referenced a `score_delta` column that
   does not exist in the `matches` table (`ERROR 1054 Unknown column
   'score_delta'`, reproduced on MariaDB 11.8.8) and omitted
   `started_at`/`finished_at`, which are `NOT NULL` without defaults. The
   statement now uses the column set of the MatchCoreArena-Server baseline
   schema: `score_delta` is dropped (the score change is already applied to
   `users.rank_score` by the preceding UPDATE) and both NOT NULL timestamps
   are set to `MatchTime`, the only timestamp the upload provides. Verified
   by executing the exact statement against a local MariaDB running the
   current baseline schema in strict mode.

### Not fixed — requires author decision

1. **Manual upload semantics beyond executability**: the INSERT writes
   `winner_uid = UID` unconditionally (even when `is_winner` is false); the
   score delta is applied to `users.rank_score` but is not recorded in
   `matches` or `match_participants`; the `match_id`, `rank` and
   `survivor_count` fields collected by the UI are ignored by the backend.
   The whole manual-upload path needs a design decision (align with the
   server's report semantics or remain an ad-hoc SQL tool).
2. **No score floor on manual updates**: the server's report path uses
   `GREATEST(0, rank_score + delta)`; the manual UPDATE here can drive
   `rank_score` negative. Whether the ops tool should mirror the floor is
   open.
3. **Redis browser page is dead**: the backend hard-disables the Redis
   client, but the UI page is kept. Restore direct Redis access or remove
   the page — needs intent.
4. **Dashboard stats are structurally zero**: `TotalRedisKeys` has no data
   source; `ActiveMatches` counts `matches WHERE finished_at IS NULL`, but
   `finished_at` is NOT NULL in the schema, so the count is always 0. The
   definition of "active match" needs a decision.
5. **No tests in the repository**: none were added in this pass (author's
   instruction: do not add a test framework here).
6. **README is still the default Wails template text**: rewriting it is
   content creation, deferred.
7. **`config.yaml` committed with a placeholder `management_token`** and not
   gitignored (nor `config_history/`): deployment convention, deferred.
8. **HA-Contract vendored as a symlink to a local absolute path**:
   distribution method, deferred (explicitly by the author).
9. **Rating algorithm duplicated from the server**: whether to share one
   implementation or add cross-repo consistency checks, deferred
   (explicitly by the author).
10. **mysql/redis clients initialized but idle**: kept per the in-code
    comment "in case they are needed later"; whether to remove them is open.

## Consequences
- Verified 2026-11-04 after the fix: `go build ./...` and `go vet ./...`
  pass; the repository contains no Go tests. Frontend `npm run build`
  (tsc + vite) passes.
- SQL verification level: full execution against a local MariaDB 11.8.8 in
  strict mode using the current MatchCoreArena-Server baseline schema. The
  fixed INSERT and the preceding users UPDATE both succeed; the pre-fix
  INSERT fails with `ERROR 1054 (42S22): Unknown column 'score_delta'`.
- Pending items above remain open; each needs a semantic or design choice
  that this pass was explicitly not allowed to make.

## Evidence
- `e833eb9` fix(match-upload): align manual upload INSERT with the real matches schema
- `internal/logic/maintenance.go::UploadMatchResult` (UploadMatchResult after the fix)
- MatchCoreArena-Server `/home/lnb/Desktop/HA/MatchCoreArena-Server/migrate/migrations/baseline.sql::matches` (matches
  schema used as the reference; read-only cross-repo check)
- MariaDB 11.8.8 session 2026-11-04: fixed INSERT created a row; pre-fix
  INSERT returned `ERROR 1054 (42S22) Unknown column 'score_delta' in
  'INSERT INTO'`.
