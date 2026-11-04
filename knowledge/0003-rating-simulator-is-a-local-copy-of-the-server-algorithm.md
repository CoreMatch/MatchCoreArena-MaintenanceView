# 0003. Rating Simulator Is a Local What-If Copy of the Server Algorithm, Not a Runtime Tuning Surface

## Status
Accepted

## Date
2026-09-19

## Context
Operators want to predict rank-score changes before correcting them manually,
and to understand how the K-factor and the various weights behave. The
authoritative algorithm lives server-side (MatchCoreArena-Server
`internal/rating`) and is applied at match-report time. This tool has no
authority to change that algorithm; it can only observe and predict it.

## Decision
The desktop app ships its own copy of the algorithm in
`internal/logic/rating.go`:

- Identical constants: placement threshold 10 wins, K decaying 520 → 390
  during placement, stability-phase K = (165 + 215) / 2 = 190.
- Identical Elo expected score with a 400 divisor.
- Identical survival-weight table (1.00 / 1.05 / 1.15 / 1.25), streak-weight
  table, and performance clamp to [0.95, 1.05].
- Same delta formula `delta = K * (S - E) * W_round * W_streak * W_perf`,
  rounded to an int.

`SimulateRating` is bound directly to the frontend and computed locally — no
network call. The Rating Simulator UI exposes only scenario inputs (player and
opponent rating, wins count, streak, survivor/initial counts, performance,
winner flag). The constants themselves are not editable anywhere in the UI or
config.

## Consequences
- Operators can explore what-if deltas offline, and the numbers match the
  server implementation line-for-line at the time of writing.
- Costs and limitations:
  - Two hand-maintained copies of the algorithm exist in two repos, with no
    shared package and no cross-repo test; a future change to server constants
    would silently desynchronize the simulator.
  - The simulator models a single player-vs-opponent expected score, whereas
    the server's team flow compares team averages — anything beyond a 1v1
    scenario is only approximated here.
  - It cannot read a real player's current rating, streak, or win count; every
    input is typed by hand.
  - It cannot change the K-factor or any weight at runtime. "Tuning" the
    algorithm still requires a server code change; this tool only explores
    parameters, it does not adjust them.
  - Results are ephemeral — nothing is persisted or logged.

## Evidence
- internal/logic/rating.go:8-14 — constants (threshold, K placement/stability)
- internal/logic/rating.go:16-18 — Elo expected score
- internal/logic/rating.go:20-27 — K-factor schedule
- internal/logic/rating.go:29-67 — survival and streak weights
- internal/logic/rating.go:69-77 — performance clamp
- internal/logic/rating.go:79-101 — SimulateRating delta formula
- app.go:78-81 — SimulateRating bound to the frontend
- frontend/src/components/RatingSimulator.tsx:17-37 — manual input state and local simulate call
- frontend/src/components/RatingSimulator.tsx:118-147 — result breakdown display
- MatchCoreArena-Server internal/rating/rating.go:8-17, 21-23, 27-37, 42-57, 74-82, 86-107, 111-114 — the server-side source the copy mirrors
- commit aa7f88ca711292bfdedc1e3082977b68388e63b3 — feat: initialize MCA maintenance desktop tool (introduced the simulator)
