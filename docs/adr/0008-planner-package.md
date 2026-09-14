# 8. The planner is a pure workspace package

- Status: Accepted
- Date: 2026-09-14

## Context
The planner grid is the product. The directory is table stakes — other sites have one — and the coverage analysis is the only part of Campout nobody else offers. It is also the part most likely to be subtly wrong, because it is a pile of date arithmetic, and date arithmetic written by an LLM is exactly where off-by-one errors live.

Two properties would make that risk manageable. Coverage logic that is **pure** is cheap to test exhaustively. Coverage logic that runs **in both the server and the browser** lets the grid re-evaluate instantly as a parent drags a session into a cell, without a round trip, using the same code the server used.

## Decision
**`@campout/planner`** — a pnpm workspace package at `packages/planner/`, pure TypeScript, `private: true`.

- **No database client, no `fetch`, no React, no environment access, no `process.env`.** Plain data in, plain data out.
- **⛔ No `new Date()` with no argument, anywhere in the package.** Every function that reasons about dates takes the date it needs as a parameter. A planner that reads the wall clock is a planner whose tests pass in September and fail in July.
- Its own `tsconfig.json` as a TypeScript project reference with `lib: ["ES2022"]` — **no DOM lib**, so a browser API used inside the package fails to compile rather than failing at runtime on the server.
- Coverage floor **95%**, versus 80% for `src`.

### What it owns

| Module | Responsibility |
|---|---|
| `weeks.ts` | The summer-week model: a district calendar in, an ordered list of Monday-anchored `SummerWeek`s out. Everything else indexes off this. |
| `coverage.ts` | **Uncovered weeks** — a week where a child has no session. |
| `overlap.ts` | **Double-booking** — two sessions for one child on the same day. |
| `hours.ts` | **Hours shortfall** — a session (including after-care) ending before the household's workday does. |
| `logistics.ts` | **Split run** — two children at locations too far apart for one drop-off. |

Each analyzer is a separate module taking a plain snapshot and returning findings. They compose; none calls another.

### Dates are calendar dates
Camp dates are handled as `YYYY-MM-DD` strings and stored as Postgres `date`. A camp running June 15–19 runs those days in Richmond regardless of where the reader is; converting to a UTC instant shifts it a day for half the country. Daily hours are wall-clock `time` values compared in the same wall-clock space. No timezone math anywhere in the package.

## Consequences
- **+** The riskiest logic in the product is the easiest to test, and 95% coverage on it is cheap rather than painful.
- **+** The grid responds instantly to edits; the server validates with identical code.
- **−** A workspace package is slightly more build ceremony than a `src/lib` folder. Worth it for the enforced purity — `src/lib` would drift into importing the Supabase client within a month, and nothing would stop it.
