# Knowledge Base

This knowledge base is the project's memo to itself. It is self-hosted and
maintained by this repository (MatchCoreArena-MaintenanceView, the
operations/maintenance desktop view for MatchCoreArena) and records internal
design decisions and their history. It does **not** define or override outward
behavior. Outward behavior is specified by HA-Contract
(https://github.com/SamuelCheston/HA-Contract); if an entry here ever
conflicts with HA-Contract, fix the entry, not the contract.

## Entries

| ID | Title | Status | Summary |
|----|-------|--------|---------|
| [0001](0001-operator-facing-wails-desktop-console-with-management-token.md) | Operator-Facing Wails Desktop Console Authenticated by a Static Management Token | Accepted | The tool is a desktop app for operators, not players: no login UI, one static management token that the server maps to UID -1 with the all-powerful `maintenance` scope. |
| [0002](0002-all-operations-tunnel-through-upstream-maintenance-sql-endpoint.md) | All Maintenance Operations Tunnel Through Upstream POST /api/maintenance/sql | Accepted | Direct MySQL/Redis access was abandoned; every data operation is now a raw SQL string sent to the contract-defined maintenance endpoint with the management token. |
| [0003](0003-rating-simulator-is-a-local-copy-of-the-server-algorithm.md) | Rating Simulator Is a Local What-If Copy of the Server Algorithm, Not a Runtime Tuning Surface | Accepted | The simulator duplicates the server's weighted-Elo constants and formula verbatim and runs locally on manual inputs; K-factor and weights are not adjustable at runtime. |
| [0004](0004-feature-completeness-inventory-working-paths-and-dead-ends.md) | Completeness Inventory: Working Paths, Dead Ends, and a Broken Match-Upload INSERT | Accepted | User management, stats (users), rating simulation and config management work; Redis browsing is hard-disabled, two dashboard stats are always 0, and the manual match-upload INSERT cannot succeed against the real schema. |
| [0005](0005-yaml-config-with-ui-edit-backup-history-and-restore.md) | YAML Config Managed In-App with Timestamped Backups, History Listing, and Restore | Accepted | config.yaml is editable from the Config Manager; every save writes a timestamped backup into config_history/, and any backup can be restored from the UI. |
| [0006](0006-wails-go-react-mui-stack-and-repository-layout.md) | Wails v2 + Go Backend with React 19/MUI Frontend; HA-Contract Vendored as a Local Symlink | Accepted | A Wails v2 desktop app (Go 1.25, React 19, MUI 9, Vite 7) with an app.go → internal/{config,logic,models} layout; HA-Contract is a committed symlink to an absolute local path. |

## Maintenance

- New entries take the next sequential number (`NNNN`, zero-padded, starting
  from 0001) and a kebab-case slug: `knowledge/NNNN-<slug>.md`.
- History is not rewritten: accepted entries are kept as-is even when they age.
- An entry that is no longer true is marked `Superseded` (or `Historical`) in
  its Status section and linked to its replacement — it is never deleted.
- Every factual claim needs evidence that was actually checked (`file:line`
  and/or full commit hash). Anything that cannot be verified is written as
  "not verified" — never invented.
- Entries are written in English.
