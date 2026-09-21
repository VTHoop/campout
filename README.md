# Campout

A planning app for working parents, for every day school is closed. Two halves:

**A camp directory** — search and filter verified local camps by child age, the week of summer or a single day off, distance from home, category, and price. List beside a map. Each camp page shows its sessions, daily hours, before- and after-care, and links out to the camp's own registration page.

**A planner grid** — children as rows, weeks of summer as columns. Drop sessions into cells and immediately see weeks with no coverage, two sessions overlapping for one child, camp hours ending before the workday does, and two children at camps too far apart for one drop-off run.

**Summer leads. The rest of the year still counts.** Summer is twelve contiguous weeks with several children and real conflicts to resolve, so it gets the grid. The other nine months hold roughly eighteen scattered closures per district — holidays, teacher workdays, conference days, breaks — and those are the ones that go unnoticed until the week before. Both ask the same question: is this day covered, and by whom?

Launch market is the Richmond, Virginia metro: Richmond city, Chesterfield, Henrico, and Hanover counties.

Campout lists camps. It does not vet, endorse, inspect, or rank them, and it never handles registration or payment.

---

## Start here

| If you are… | Read |
|---|---|
| An agent or a new contributor | **[`AGENTS.md`](./AGENTS.md)** — the working contract. Non-negotiable. |
| Getting oriented | [`docs/CONTEXT.md`](./docs/CONTEXT.md) |
| Looking for the "why" | [`docs/adr/`](./docs/adr/) |
| Touching camp data | [`docs/data/camp-record-spec.md`](./docs/data/camp-record-spec.md) |
| Writing code | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and [`docs/ABSTRACTIONS.md`](./docs/ABSTRACTIONS.md) |
| Building UI | [`docs/DESIGN.md`](./docs/DESIGN.md) |

## Stack

Next.js (App Router) on Vercel · Supabase Postgres with PostGIS · Supabase Auth with Row Level Security · MapLibre GL · Tailwind v4 + shadcn/ui · a pure TypeScript planner package shared by server and browser.

Each choice has an ADR. See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the table.

## Setup

Requires **Node 24** (`.nvmrc`), **pnpm 11**, and **Docker** for the local Supabase stack.

```bash
pnpm install
cp .env.example .env.local     # then fill it in
pnpm supabase:start            # local Postgres + Supabase services
pnpm supabase:reset            # apply migrations
pnpm dev
```

## Commands

```bash
pnpm dev             # Next.js dev server
pnpm build           # production build

pnpm lint            # Biome — format + lint, zero warnings
pnpm typecheck       # tsc -b across the app and the planner package
pnpm test            # Vitest, fast lane
pnpm test:coverage   # Vitest + the ratcheted coverage floors
pnpm test:rls        # Row Level Security policy tests (needs local Supabase)
pnpm e2e:smoke       # Playwright smoke lane

pnpm db:types        # regenerate src/lib/db/types.ts from the local schema
pnpm codescene:check # the absolute code-health ratchet
```

## How this repo protects itself from its own agents

Most of this codebase is written by AI agents. Agents fail in a specific way: when a test or a gate blocks progress, the cheapest path to green is to weaken the gate. Three mechanisms make that path unavailable.

**Two `PostToolUse` hooks block the turn**, rather than leaving a rule for someone to remember:

| Hook | Blocks |
|---|---|
| [`tdd-guard.sh`](./.claude/hooks/tdd-guard.sh) | An added `.skip`/`.only`, a removed test or `describe`, net-removed assertions, a lowered coverage floor, a lowered code-health floor |
| [`privacy-guard.sh`](./.claude/hooks/privacy-guard.sh) | A forbidden child field, a free-text note on a child, a user-data table created without RLS, the service-role key in application code |

**Ratchets only move upward.** Coverage floors (95% on the planner, 80% on the app) and the CodeScene health floor can be raised, never lowered — and the hook enforces that, not just the docs.

**An adversarial reviewer runs after every code-editing turn.** The [challenger](./.claude/agents/challenger.md) is a separate context with no write access, so the author never grades its own work.

The full contract is in [`AGENTS.md`](./AGENTS.md).

## Privacy

Campout stores a child's **first name, integer age, and grade. Nothing else** — no last name, no birth date, no health information, and no free-text note. This is enforced by the schema and by a hook, not by policy (ADR-0006).

Sensitive family data for filling in registration forms stays in the browser and never reaches the server.

## License

Not yet licensed. All rights reserved pending a decision.
