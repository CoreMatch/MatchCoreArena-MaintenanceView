# 0007. Manual Upload Schema Alignment and Pending Design Decisions

## Status
Accepted

## Date
2026-11-04

## Context
This entry records why the manual match-upload statements are shaped the way
they are, and lists the design-level issues that are open and need author
decisions. Items with a single correct answer (statements that can never
execute, doc-vs-code mismatches) are fixed as found and need no entry.

## Decision

### Manual match-upload INSERT

`UploadMatchResult` executes one `UPDATE users` — applying the score delta
and the win increment — followed by one `INSERT INTO matches` that uses the
column set of the MatchCoreArena-Server baseline schema:

- `score_delta` is not written to `matches`: the table has no such column,
  and the score change is already applied to `users.rank_score` by the
  preceding UPDATE.
- Both NOT NULL timestamps, `started_at` and `finished_at`, are set to
  `MatchTime`, the only timestamp the upload provides.
- `match_type` is fixed to `'1v1'` and `winner_uid` to the uploading
  player's UID.

The statement is verified by executing it against a local MariaDB in strict
mode running the current baseline schema; the INSERT and the preceding users
UPDATE both succeed.

### Open items — requires author decision

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
5. **No tests in the repository**: adding a test framework is deferred
   (explicitly by the author).
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
- The upload path executes end to end against the baseline schema.
- The open items above each need a semantic or design choice; they stay
  listed here until decided.

## Evidence
- internal/logic/maintenance.go::UploadMatchResult — UploadMatchResult with the baseline-schema INSERT
- /home/lnb/Desktop/HA/MatchCoreArena-Server/migrate/migrations/baseline.sql::matches — matches schema used as the reference (read-only cross-repo check)
