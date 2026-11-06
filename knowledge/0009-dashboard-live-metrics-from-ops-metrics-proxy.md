# 0009. Dashboard Reads Live Queue Depth and Match Counters from the OPS Metrics Proxy

## Status
Accepted

## Context
The Dashboard previously displayed three cards: Total Users, Active Matches,
and Redis Keys. The last two could never be anything but 0: Active Matches
counted `matches WHERE finished_at IS NULL` while the server baseline declares
`finished_at TIMESTAMP NOT NULL`, and the console deliberately never talks to
Redis directly. Showing a zero for data the UI cannot obtain is a silent
failure — operators cannot tell "nothing is queued" from "metrics are broken".

The backend already holds OPS credentials and proxies `GET /api/metrics`
(`App.GetMetrics`), returning `models.MetricsSnapshot{Counters, QueueDepth}`.
Its `queue_depth` is the current number of queued players per mode and its
`matches_reported_total` counter counts reported matches.

## Decision
- Keep the Total Users card on `GetSystemStats` (maintenance SQL), the one
  dashboard number that is genuinely backed by a working path.
- Replace "Active Matches" with "In Queue": the sum of
  `Object.values(metrics.queue_depth)`.
- Replace "Redis Keys" with "Matches Reported":
  `metrics.counters["matches_reported_total"] ?? 0`.
- Treat missing data as unknown, never as zero: if `GetMetrics` fails (OPS
  token not configured, upstream unreachable), the two metrics cards render
  an en dash ("—") and the card area shows a one-line English hint
  (`dashboard.metricsUnavailable`). Total Users likewise renders "—" if
  `GetSystemStats` fails instead of defaulting to 0.
- No server, contract, or permission changes: the dashboard consumes the
  existing OPS-only metrics proxy and does not widen the OPS/player boundary.

## Consequences
- Dashboard numbers now map to real server state and remain honest when the
  upstream is unavailable.
- En dash ("—") is a deliberate third state (unknown), distinct from a real 0.
- The dashboard now depends on a reachable upstream and an OPS-level token;
  without them it degrades to "—" plus the hint rather than failing silently
  or crashing.
- i18n keys `dashboard.activeMatches` and `dashboard.redisKeys` are gone;
  `dashboard.inQueue`, `dashboard.matchesReported`, and
  `dashboard.metricsUnavailable` replace them.

## Evidence
- frontend/src/components/Dashboard.tsx::GetMetrics — fetch, `inQueue` sum, `matchesReported` lookup, `UNKNOWN` ("—") fallback
- frontend/src/components/Dashboard.tsx::metricsUnavailable — hint rendered when `metricsError` is set
- frontend/src/i18n/index.ts::dashboard — new card titles and hint
- app.go::GetMetrics — Wails binding
- internal/logic/mca.go::GetMetrics — `GET /api/metrics` proxy, maps normalized to empty maps
- internal/models/models.go::MetricsSnapshot — `Counters` / `QueueDepth map[string]int64`
- knowledge/0004-feature-completeness-inventory-working-paths-and-dead-ends.md — inventory updated to the current dashboard data sources
