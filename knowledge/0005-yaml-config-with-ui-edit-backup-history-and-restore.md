# 0005. YAML Config Managed In-App with Timestamped Backups, History Listing, and Restore

## Status
Accepted

## Date
2026-09-19

## Context
The tool's behavior depends on environment-specific values: the upstream URL,
the management token, and (vestigially) the MySQL DSN and Redis address. At
first these could only be edited by hand in `config.yaml`, and a bad edit
could break the tool's connectivity with no way to roll back. Commit 8fbb1d9
introduced YAML loading with built-in defaults; commit b743005 added full
in-app management.

## Decision
- Config is a single YAML file (`config.yaml`) loaded once at startup; if the
  file is missing, built-in defaults are used (upstream
  `https://arena.mcnb.dev/`, local MySQL DSN, local Redis address).
- The Config Manager page edits `upstream_url`, `management_token`,
  `database.dsn`, and `redis.*`. "Save & Backup" first copies the existing
  `config.yaml` to `config_history/config_<YYYYmmdd_HHMMSS>.yaml`, then writes
  the new YAML and refreshes the in-memory config.
- `GetConfigHistory` lists the `config_history/` directory (files matching
  `config_*.yaml`) newest-first; each row offers a restore action.
- `RestoreConfig` reads the chosen backup, first snapshots the current file as
  `config_before_restore_<timestamp>.yaml`, overwrites `config.yaml`, and
  reloads the in-memory struct.
- Upstream calls pick up changes without a restart because the HTTP helper
  reads the live config pointer on every request.

## Consequences
- An operator can roll back a bad config change from the UI, and every save is
  protected by a pre-write backup.
- Costs and limitations:
  - All paths are relative (`config.yaml`, `config_history/`), so behavior
    depends on the process working directory at launch.
  - `config.yaml` is committed to the repo, and neither it nor `config_history/`
    is gitignored; saving a real token through the UI places a plaintext secret
    into the working tree.
  - Backup write failures are ignored (`_ = os.WriteFile`), so the "saved and
    backed up" success message can be false.
  - History has no retention limit or cleanup; versions are identified only by
    filename timestamp, and restore does not validate that a backup parses
    before overwriting (a parse failure only skips the in-memory refresh).
  - The management token round-trips through the frontend via `GetConfig`, so
    it is visible in the webview despite the masked input field.

## Evidence
- internal/logic/maintenance.go::SaveConfig — SaveConfig with pre-write timestamped backup
- internal/logic/maintenance.go::GetConfigHistory — GetConfigHistory directory listing, newest-first
- internal/logic/maintenance.go::RestoreConfig — RestoreConfig with pre-restore snapshot
- internal/logic/maintenance.go::doRequest, internal/logic/maintenance.go::GetConfig — per-request config reads; GetConfig
- internal/config/config.go::DefaultUpstreamURL — built-in defaults
- internal/config/config.go::LoadConfig — load with missing-file fallback to defaults
- internal/models/models.go::ConfigHistoryItem, internal/models/models.go::Config — Config / ConfigHistoryItem models
- app.go::SaveConfig, app.go::GetConfigHistory, app.go::RestoreConfig — SaveConfig/GetConfigHistory/RestoreConfig bindings with cache refresh
- frontend/src/components/ConfigManager.tsx::ConfigManager — editor, save, history table, restore
- config.yaml (field: management_token) — committed config with placeholder token
- .gitignore::build — config.yaml and config_history/ are not ignored
- commit 8fbb1d9585517c75f6e0a74f07e6a5f4ace39fd1 — feat: add yaml config support and refactor service to use config
- commit d71ac1f8152a98bad47278d8015b4e909710f325 — renamed `api_token` to `management_token`
- commit b7430052b2dc95eb82885c61fafacf7207a14f13 — feat(config): add config management with backup, history and restore
