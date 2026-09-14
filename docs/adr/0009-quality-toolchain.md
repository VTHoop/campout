# 9. Quality toolchain: Biome, tsc, Vitest, Playwright, Lefthook

- Status: Accepted
- Date: 2026-09-14

## Context
ADR-0005 set the process. This ADR picks the tools that run it, and every choice optimizes for the same thing: a gate that runs in seconds is a gate that actually runs, and a gate nobody runs is documentation.

## Decision

| Concern | Tool | Script |
|---|---|---|
| Lint + format | **Biome** (`biome.json`) | `pnpm lint` / `pnpm lint:fix` |
| Type safety | **tsc project build** (`tsc -b`) | `pnpm typecheck` |
| Unit tests | **Vitest** | `pnpm test` |
| Coverage gate | **Vitest v8** provider, dual floors | `pnpm test:coverage` |
| RLS policy tests | **Vitest** against local Supabase | `pnpm test:rls` |
| Smoke lane | **Playwright** (Chromium) | `pnpm e2e:smoke` |
| Git hooks | **Lefthook** | `lefthook.yml` |

### Biome over ESLint + Prettier
One binary for lint and format, no plugin graph, no drift between the two tools, and fast enough to run on every commit without anyone resenting it. Next.js scaffolds an ESLint config by default; we remove it rather than run both.

### `tsc -b` with project references
`tsconfig.json` references the app and the planner package. `tsc -b` respects the reference graph, which is what enforces ADR-0008's boundary: the planner compiles under `lib: ["ES2022"]` with no DOM, so a browser API inside it is a compile error. Both referenced configs carry `noEmit`, so this is a pure check.

**Typechecking is the single highest-value gate on LLM-written code.** It catches a category of confident, plausible, wrong that no linter sees.

### Dual coverage floors
95% on `packages/planner`, 80% on `src`. Rationale in ADR-0008: the planner is pure functions and is the product claim; `src` is React and route handlers where meaningful coverage on data paths beats padded coverage on layout. `thresholdAutoUpdate` stays off — the floors are a ratchet, and the TDD guard hook blocks any edit that lowers one.

### RLS tests are a separate lane
They need Docker and a local Supabase instance, so they do not belong in the fast `pnpm test` lane that runs on every commit. They run in CI and before any PR touching a policy. Separating them keeps the inner loop fast without making them optional (ADR-0004).

### Playwright smoke lane
Chromium only, under five minutes, asserting the app mounts and no uncaught errors fire. This catches the class of failure where the whole app is broken — a bad provider, a missing env var — which unit tests structurally cannot see.

### Lefthook
`pre-commit` runs Biome on staged files plus typecheck. `pre-push` runs the full suite plus the CodeScene delta. Hooks that skip cleanly when an optional tool is absent, so a fresh clone can still push — **which means a passing hook with nothing installed checked nothing.** Know which you have.

## Consequences
- All gates run locally in seconds, so they get run rather than discovered in CI.
- The coverage floors are a ratchet: up only, never down.
- Playwright browsers must be installed in CI (`playwright install chromium`).
- RLS tests require Docker locally, which is the heaviest dependency in the toolchain. Accepted for what they protect.
- Node 24 is required and pinned in `.nvmrc`.
