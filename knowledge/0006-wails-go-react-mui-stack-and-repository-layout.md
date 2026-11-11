# 0006. Wails v2 + Go Backend with React 19/MUI Frontend; HA-Contract Vendored as a Local Symlink

## Status
Accepted

## Context
The project needed an operator UI with direct access to Go-side HTTP and
config logic, distributable to individual operators without hosting anything.

## Decision
- Wails v2 (v2.15.0) desktop app: Go module `MCA-Maintenance` on Go 1.25.0.
  The built frontend is embedded via `//go:embed all:frontend/dist` and the
  `App` struct is bound to it; the Linux build uses the `webkit2_41` tag.
- Frontend: React 19 + TypeScript + Vite 7 + MUI 9 (dark theme), a single
  page with a fixed sidebar routing between six views (Dashboard, Redis
  Browser, Database, Match Manager, Rating Simulator, Config Manager).
- Backend layout: `app.go` holds all Wails-bound methods and delegates to
  `internal/logic` (MaintenanceService + rating simulation), with DTOs in
  `internal/models` and YAML loading in `internal/config`. The frontend calls
  Go through generated bindings under `frontend/wailsjs/`.
- HA-Contract is vendored as a committed symlink at the repo root pointing to
  the absolute local path `/home/lnb/Desktop/HA/HA-Contract/`;
  `.trae/rules/docs.md` declares HA-Contract the sole documentation authority.
- `go-sql-driver/mysql` and `go-redis/v9` remain as dependencies for the
  direct-access clients that are initialized but currently unused (entry
  0002); `goccy/go-yaml` handles config parsing and saving.

## Consequences
- Single-binary distribution with no server component; the UI calls Go
  directly with no internal HTTP layer.
- Costs and limitations:
  - The HA-Contract symlink is an absolute path; it resolves only on the
    original author's machine layout and dangles in any other checkout.
  - The frontend must be built before the Go binary embeds it, and the
    committed generated bindings can drift from `app.go` if regeneration is
    forgotten after changing bound methods.
  - `recharts` and `lucide-react` were originally declared but never
    imported; both were dropped from `package.json` on 2026-11-11
    (dead-dependency cleanup), so the runtime dep set is now exactly
    React 19, MUI 9 (via `@mui/material`), Emotion, and `react-dom`.
  - The root README.md is still the stock Wails template text and does not
    describe this tool.

## Evidence
- go.mod (field: module) — module name, Go 1.25.0, direct dependencies
- main.go::assets — embed of frontend/dist, Wails options, bound App
- wails.json (field: build:tags) — project config incl. `build:tags: webkit2_41`
- frontend/package.json (field: dependencies) — React 19, MUI 9, Vite 7
- frontend/src/App.tsx::menuItems — imports, theme, sidebar menu
- app.go::App — full Wails-bound method surface
- frontend/wailsjs/go/main/App.d.ts::SimulateRating — generated binding surface
- .trae/rules/docs.md::HA-Contract — HA-Contract as documentation authority
- README.md::About — stock Wails template README
- git ls-tree HEAD — `HA-Contract` mode 120000, target `/home/lnb/Desktop/HA/HA-Contract/`
