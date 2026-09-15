# CONTEXT — start here

Orientation for any human or agent opening this repo. **`AGENTS.md` is the working contract (the *how*); the ADRs are the *why*; this file says where everything lives.**

## What this is

**Campout** — a summer-planning web app for working parents. Two halves:

1. **A camp directory.** Search and filter verified local camps by child age, week of summer, distance from home, category, and price. List beside a map. Each camp page shows its sessions, daily hours, before- and after-care, and links out to the camp's own registration page. **Campout never handles registration or payment.**
2. **A planner grid.** Children as rows, weeks of summer as columns. A parent drops camp sessions into cells and immediately sees four things: weeks with no coverage, two sessions overlapping for one child, camp hours ending before the workday does, and two children at camps too far apart for one drop-off run.

**The grid is the differentiator. The directory is table stakes.** Existing Richmond camp directories are paid-listing ad pages — no map, no filters, no dates, no way to plan across multiple children.

Launch market is the Richmond, Virginia metro: Richmond city, Chesterfield, Henrico, and Hanover counties.

## How the work runs

Two people, part-time, building largely through AI coding agents. **Scope for any task comes from its Linear issue** — not from this file, and not from an agent's own reading of what the product needs next. `AGENTS.md` §0 covers the working style; the short version is that boring beats clever, and the gates in §1 are not optional.

## Where the reasoning lives

- **`AGENTS.md`** / `CLAUDE.md` — the engineering contract: TDD, PR flow, quality gates, product rules. **Read first.**
- **`docs/adr/`** — every significant decision and its rationale. Start with ADR-0002 (Supabase), ADR-0004 (RLS), and ADR-0006 (child data).
- **`docs/ARCHITECTURE.md`** — the stack and where each file lives.
- **`docs/ABSTRACTIONS.md`** — the patterns you are expected to reuse rather than reinvent.
- **`docs/data/camp-record-spec.md`** — every camp field, what counts as verified, and what must never be stored. Read before touching catalog data.

## Cardinal rules (full text in `AGENTS.md` §2 and the ADRs)

These are the four an agent is most likely to break, and the ones most expensive to undo.

1. **Child data minimization (ADR-0006).** A first name, an integer age, a grade. Nothing else — no last name, no birth date, no health information, and **no free-text note on a child**. Enforced by the schema and by `.claude/hooks/privacy-guard.sh`, not by anyone remembering.
2. **The vault stays in the browser (ADR-0006).** Emergency contacts, insurance, medical history for form-filling live in browser storage only. They never reach the server. Cross-device sync needs a new ADR and a conversation with the humans.
3. **Row Level Security is the only boundary between families (ADR-0004).** Every user-data table enables it in the migration that creates it, and every policy ships with a negative-case test. The service-role key never appears in application code.
4. **We list camps; we do not vet them (AGENTS.md §2).** Every record carries `source_url` and `verified_at`, both required. No UI copy, ordering, or badge may imply endorsement, safety screening, or a quality ranking.

## Guards that will stop you

Two `PostToolUse` hooks run on every `Edit` and `Write`. They are not advisory — they block the turn.

| Hook | Blocks |
|---|---|
| `.claude/hooks/tdd-guard.sh` | An added `.skip`/`.only`, a removed test or `describe`, net-removed assertions, a lowered coverage floor, a lowered code-health floor |
| `.claude/hooks/privacy-guard.sh` | A forbidden child field, a free-text note on a child, a user-data table created without RLS, the service-role key in `src/` or `packages/` |

If one fires, **fix the code — do not work around the hook.** Both were tested against their own failure cases when written.

## What is already here

| Area | State |
|---|---|
| Engineering contract, ADRs, orientation docs | in place |
| Toolchain — Biome · tsc · Vitest · Playwright · Lefthook · CI | wired and passing |
| Agent guards — TDD guard, privacy guard | installed, and tested against their own failure cases |
| Schema — catalog and household migrations, RLS on every table | written, **not yet applied to a Supabase project** |
| `@campout/planner` — the summer-week model | shipped, covered at 100% |
| RLS policy tests | in place — 24 tests, two households, two JWTs, real Postgres in CI |
| CodeScene ratchet | wired to project 84686; floor at 9.90 / 9.80 against a measured 10.00 |

`packages/planner/src/weeks.ts` and its tests are the reference example of the loop this repo expects: pure, dates passed in as arguments, bad input refused loudly, fully covered. Read them before writing your first module here.
