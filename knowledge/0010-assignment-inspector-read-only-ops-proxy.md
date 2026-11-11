# 0010. Assignment Inspector Is a Read-Only Proxy of the OPS Assignment Endpoint

## Status
Accepted

## Context
VelocityGate routes connecting players by asking the server whether the
player currently holds a formed-group assignment. When a player ends up in
the lobby instead of a match, that same question is the first thing an
operator needs answered, but this console had no way to ask it. The answer
already exists in the business contract as `GET
/api/matchmaking/assignment/{uuid}` (v1.9.0, extended by the v1.10.0 room
layer), so the gap is purely a missing read-only viewer.

## Decision
- Add an Assignment Inspector page that consumes the existing contract
  endpoint `GET /api/matchmaking/assignment/{uuid}`. No server endpoint,
  route, permission, or response shape is added or changed by this
  repository; the page is a consumer of the contract as published.
- Proxy the call in the Go backend (`MaintenanceService.GetAssignment`)
  with `s.serviceToken()` (reporter token, falling back to the management
  token), exactly like the other OPS reads. Credentials stay in the backend;
  the frontend only calls the bound `App.GetMatchAssignment` method and never
  sees token material.
- Trim the input UUID and escape it with `url.PathEscape`; an empty or
  whitespace-only UUID is rejected locally with a readable error before any
  upstream call. Upstream failures are translated by the shared
  `translateMCAError` mechanism, so `oauth_insufficient_scope` and
  `oauth_hrpauth_down` surface as readable English while keeping their code
  and HTTP status.
- Model the response as `models.MatchAssignment` with `assigned` required
  and the optional fields omitted when absent; `join_target` is a pointer so
  a deployment without a configured game-server address stays distinguishable
  from a zero-valued target.
- Render the raw result rather than inferring routing: `assigned` as a
  status chip, then `group_id`, `match_type`, `formed_at`, `team_id`, `room`
  and `join_target` as `host:port`. When `assigned` is false and
  `reason=no_room_available`, show the English explanation that a valid
  formed group exists but no room can currently be served; other unassigned
  answers show the plain "no assignment" explanation (unknown UUID, no
  formed group, settled group, or expired assignment). The page states that
  it is read-only, that data comes through the backend OPS proxy, and that
  virtual (ops-fed) and real matches share the same matchmaking endpoints.
- All user-visible copy lives in the `assignment` section of
  `frontend/src/i18n/index.ts`; the navigation entry is added next to
  Matchmaking.

## Consequences
- Operators can distinguish "the player was never assigned", "the assignment
  was settled or expired", and "a valid group exists but its room cannot be
  served" without reading server logs.
- An unknown UUID is not an error: the server answers `200 {assigned:false}`
  and the page renders the unassigned state. A 502 HRPAuth resolution failure
  is a real error and is shown as such.
- The page inherits the existing OPS posture: it requires a reachable
  upstream and an OPS-level credential, and it exposes no member lists,
  scores, payloads, or credentials — matching the endpoint's deliberately
  minimal routing surface.
- The view never mutates matchmaking state (no join/leave/settle calls), so
  inspecting an assignment cannot consume or alter it.

## Evidence
- internal/models/models.go::MatchAssignment — assignment response shape with optional `join_target`
- internal/logic/mca.go::GetAssignment — trimmed UUID, path escaping, `serviceToken()`, parse error wrapping
- app.go::GetMatchAssignment — Wails binding delegating to `GetAssignment`
- internal/logic/mca_test.go::TestGetAssignment_AssignedTrue — assigned=true parsing incl. `room` and `join_target`, Bearer header assertion
- internal/logic/mca_test.go::TestGetAssignment_NotAssignedNoRoom — `assigned=false` with `reason=no_room_available` and omitted fields
- internal/logic/mca_test.go::TestGetAssignment_EmptyUUID — empty input rejected without an upstream call
- internal/logic/mca_test.go::TestGetAssignment_UpstreamErrorPropagated — `oauth_hrpauth_down` translation
- frontend/src/components/AssignmentInspector.tsx::AssignmentInspector — input, lookup, assignment card, and `no_room_available` explanation
- frontend/src/components/AssignmentInspector.tsx::joinTargetText — `host:port` rendering with em-dash fallback
- frontend/src/i18n/index.ts::assignment — English copy incl. the read-only/proxy statement
- frontend/src/App.tsx::menuItems — navigation entry beside Matchmaking
- /home/lnb/Desktop/HA/HA-Contract/docs/api/openapi/matchcorearena-business.yaml::MatchAssignment — contract shape (v1.10.0)
- /home/lnb/Desktop/HA/HA-Contract/docs/api/openapi/matchcorearena-business.yaml::/api/matchmaking/assignment/{uuid} — OPS-only endpoint consumed here
