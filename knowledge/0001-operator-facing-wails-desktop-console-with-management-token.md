# 0001. Operator-Facing Wails Desktop Console Authenticated by a Static Management Token

## Status
Accepted

## Date
2026-09-19

## Context
MatchCoreArena-MaintenanceView exists to operate and administer the
MatchCoreArena service (MatchCoreArena-Server): inspect users, correct rank
scores, upload match results manually, simulate the rating formula, and manage
its own configuration. It must not be confused with a player-facing client —
players interact through the game ecosystem and match reporters, not through
this tool. The repository's own documentation rule already declares HA-Contract
the sole authoritative source for API documentation, so this tool defines no
outward behavior of its own.

## Decision
The tool is an operator-only console, and its identity model reflects that:

- It is a Wails v2 desktop application (window title "MCA-Maintenance"), not a
  hosted web service; Go methods are bound directly to the embedded React
  frontend.
- There is no login screen and no per-operator identity. The tool holds a
  single static `management_token` in `config.yaml` and sends it as
  `Authorization: Bearer <token>` on every upstream request.
- On the server side this token is a super-credential: verification
  short-circuits to UID -1 with scopes `["maintenance"]`, and the `maintenance`
  scope implies every other scope. The only upstream endpoint the tool uses
  today, `POST /api/maintenance/sql`, requires exactly that scope.
- The feature surface is administrative only: Dashboard (system stats),
  Database (user list + rank-score edits), Match Manager (manual result
  upload), Rating Simulator, and Config Manager. No player-facing feature
  (friends, teams, leaderboard browsing for players) exists.

## Consequences
- Operators can run the console from any machine that can reach the upstream
  URL; no server-side hosting or player OAuth flow is needed.
- Costs and limitations:
  - Whoever holds the management token has unrestricted raw-SQL access to the
    production database through the server. There is no per-operator
    attribution, no audit trail in this tool, and no token refresh/expiry
    handling on this side.
  - The token is stored in plaintext in `config.yaml` (a placeholder value is
    committed to git) and is returned verbatim to the frontend via `GetConfig`;
    the UI only masks the input field.
  - Distribution means handing each operator a binary plus a config file; this
    repo contains no provisioning or revocation mechanism.
  - The super-scope semantics live in the server repo; this repo merely
    benefits from them and documents none of that contract itself.

## Evidence
- main.go:14-35 — Wails app options, `Title: "MCA-Maintenance"`
- wails.json:3-4 — app/output name "MCA-Maintenance"
- config.yaml:2-3 — `upstream_url` and `management_token` placeholder
- internal/logic/maintenance.go:73-76 — Bearer header set from `ManagementToken`
- frontend/src/App.tsx:51-58 — admin-only menu items; frontend/src/App.tsx:81-86 — "MCA Maintenance Panel" header
- frontend/src/components/ConfigManager.tsx:126-134 — token edited as a password field
- MatchCoreArena-Server internal/auth/verifier.go:47-54 — management token maps to UID -1, scopes ["maintenance"]
- MatchCoreArena-Server api/middleware/auth.go:103-113 — `HasScope`: maintenance implies all scopes
- MatchCoreArena-Server api/handler/maintenance.go:26-31 — ExecuteSQL requires the maintenance scope
- MatchCoreArena-Server api/router.go:93 — `api.POST("/maintenance/sql", ...)` inside the authenticated group
- .trae/rules/docs.md:1-5 — HA-Contract is the sole documentation authority
- commit aa7f88ca711292bfdedc1e3082977b68388e63b3 — feat: initialize MCA maintenance desktop tool
- commit 00fb0523ae3b91379469bbc4f34c6728db03e876 — feat(maintenance): add upstream API and token auth
