# 0007. Manual Upload Schema Alignment and Pending Design Decisions

## Status
Accepted

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

### Settled items (2026-11-08, leftover-cleanup batch)

1. **Manual upload semantics** — settled: the manual-upload page remains an
   **ad-hoc emergency SQL tool**, not a second report path. Aligning it with
   the server's report semantics is moot because the Match Reporter page
   already is the aligned path (regular reporting endpoint, contract
   v1.4.0). The ad-hoc semantics are therefore documented as-is:
   `winner_uid = UID` unconditionally (a losing 1v1 upload cannot name the
   absent opponent), score delta applied only to `users.rank_score`, and
   the UI-collected `match_id`/`rank`/`survivor_count` ignored. Operators
   use it knowingly for bare corrections; the root `PENDING-DECISIONS.md`
   item 3 records the keep-or-delete decision (keep).
2. **Score floor** — settled and implemented: both manual statements now
   mirror the server's floor, `rank_score = GREATEST(0, rank_score + delta)`
   in `UploadMatchResult` and `rank_score = GREATEST(0, value)` in
   `UpdateUserRankScore`, so ops corrections can no longer drive
   `rank_score` negative.
3. **Redis browser page** — settled: the dead page is **removed**
   (frontend component, nav entry, i18n strings, the `GetRedisKeys`/
   `DeleteRedisKey` bindings and service methods, and `models.RedisKey`).
   Restoring direct Redis access stays rejected: all data operations tunnel
   through the upstream maintenance SQL endpoint by design (entry 0002), so
   the page could never work; keeping it only advertised a dead surface.
4. **Dashboard stats** — settled: the structurally zero counters are
   **removed** (`SystemStats.ActiveMatches`/`RedisKeys` and the
   `matches WHERE finished_at IS NULL` query). "Active match" is not
   representable in the baseline schema (`finished_at` NOT NULL), so no
   definition was invented; the dashboard's live queue/match numbers come
   from the OPS metrics proxy (entry 0009) and degrade to "—" when
   unavailable.

### Closed without change (author-deferred or keep, recorded 2026-11-08)

5. **No tests in the repository** — closed as author-deferred (explicit
   author decision); no test framework added.
6. **README is still the default Wails template text** — closed as
   deferred content creation.
7. **`config.yaml` committed with a placeholder `management_token`** —
   closed as a deployment convention, deferred.
8. **HA-Contract vendored as a symlink to a local absolute path** — closed
   as author-deferred distribution method.
9. **Rating algorithm duplicated from the server** — closed as
   author-deferred (entry 0003 documents the local copy).
10. **mysql/redis clients initialized but idle** — closed as **keep**: the
    in-code intent ("in case they are needed later") is an explicit keep
    rationale and the idle clients carry no risk.

## Consequences
- The upload path executes end to end against the baseline schema, with
  the server-aligned score floor.
- No open items remain in this entry; product-level MCA questions live in
  the root `PENDING-DECISIONS.md`.

## Evidence
- internal/logic/maintenance.go::UploadMatchResult — UploadMatchResult with the baseline-schema INSERT
- /home/lnb/Desktop/HA/MatchCoreArena-Server/migrate/migrations/baseline.sql::matches — matches schema used as the reference (read-only cross-repo check)
