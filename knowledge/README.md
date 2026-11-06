# Knowledge Base

This knowledge base is the project's memo to itself. It is self-hosted and
maintained by this repository (MatchCoreArena-MaintenanceView, the
operations/maintenance desktop view for MatchCoreArena) and records internal
design decisions. It does **not** define or override outward
behavior. Outward behavior is specified by HA-Contract
(https://github.com/SamuelCheston/HA-Contract); if an entry here ever
conflicts with HA-Contract, fix the entry, not the contract.

## Entries

| ID | Title | Status | Summary |
|----|-------|--------|---------|
| [0001](0001-operator-facing-wails-desktop-console-with-management-token.md) | Operator-Facing Wails Desktop Console Authenticated by a Static Management Token | Accepted | The tool is a desktop app for operators, not players: no login UI, one static management token that the server maps to UID -1 with the all-powerful `maintenance` scope. |
| [0002](0002-all-operations-tunnel-through-upstream-maintenance-sql-endpoint.md) | All Maintenance Operations Tunnel Through Upstream POST /api/maintenance/sql | Accepted | Every data operation is a raw SQL string sent to the contract-defined maintenance endpoint with the management token; the local MySQL/Redis clients are constructed but unused. |
| [0003](0003-rating-simulator-is-a-local-copy-of-the-server-algorithm.md) | Rating Simulator Is a Local What-If Copy of the Server Algorithm, Not a Runtime Tuning Surface | Accepted | The simulator duplicates the server's weighted-Elo constants and formula verbatim and runs locally on manual inputs; K-factor and weights are not adjustable at runtime. |
| [0004](0004-feature-completeness-inventory-working-paths-and-dead-ends.md) | Completeness Inventory: Working Paths and Dead Ends | Accepted | User management, stats, rating simulation and config management work; Redis browsing is hard-disabled, while the dashboard's queue and match counters come from the live OPS metrics proxy (entry 0009) and degrade to "—" when unavailable. |
| [0005](0005-yaml-config-with-ui-edit-backup-history-and-restore.md) | YAML Config Managed In-App with Timestamped Backups, History Listing, and Restore | Accepted | config.yaml is editable from the Config Manager; every save writes a timestamped backup into config_history/, and any backup can be restored from the UI. |
| [0006](0006-wails-go-react-mui-stack-and-repository-layout.md) | Wails v2 + Go Backend with React 19/MUI Frontend; HA-Contract Vendored as a Local Symlink | Accepted | A Wails v2 desktop app (Go 1.25, React 19, MUI 9, Vite 7) with an app.go → internal/{config,logic,models} layout; HA-Contract is a committed symlink to an absolute local path. |
| [0007](0007-cleanup-pass-checklist.md) | Manual Upload Schema Alignment and Pending Design Decisions | Accepted | The manual match-upload INSERT follows the MatchCoreArena-Server baseline schema, with rationale; design-level issues are listed as pending author decisions. |
| [0008](0008-match-operations-debug-console-proxies-mca-business-api.md) | Match Operations Debug Console Proxies the MCA Business API with Backend-Held Tokens | Accepted | Match Reporter/Matchmaking/Rankings pages proxy the live business API (single match entry point `POST /api/matches`, no virtual-match concept) with backend-held OPS tokens; typed error envelopes are translated into readable English messages, and UI copy is centralized in `frontend/src/i18n/`. |
| [0009](0009-dashboard-live-metrics-from-ops-metrics-proxy.md) | Dashboard Reads Live Queue Depth and Match Counters from the OPS Metrics Proxy | Accepted | Dashboard shows In Queue (sum of `queue_depth`) and Matches Reported (`matches_reported_total`) from `GET /api/metrics`, replacing two structurally-always-zero cards; on metrics failure the cards show "—" plus a hint instead of a fabricated 0. |

## Maintenance

- New entries take the next sequential number (`NNNN`, zero-padded, starting
  from 0001) and a kebab-case slug: `knowledge/NNNN-<slug>.md`.
- Entries describe the current state of the project only — never how things
  used to be. When the code changes, affected entries are updated, and
  content about removed code or retired behavior is deleted outright. The
  single exception is a change of design intent: "why it is this way now,
  unlike before" may be written when deleting it would make the current
  state incomprehensible.
- Every factual claim needs evidence that was actually checked in the current
  code (`file:line` and/or symbol anchors). Anything that cannot be verified
  is written as "not verified" — never invented.
- Entries are written in English.
