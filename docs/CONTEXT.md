# CONTEXT — start here

Orientation for any human or agent opening this repo. **`AGENTS.md` is the working contract (the *how*); the ADRs are the *why*; this file says where everything lives.**

## What this is

**Campout** — a planning app for working parents, for every day school is closed. Two halves:

1. **A camp directory.** Search and filter verified local camps by child age, the week of summer or a single day off, distance from home, category, and price. List beside a map. Each camp page shows its sessions, daily hours, before- and after-care, and links out to the camp's own registration page. **Campout never handles registration or payment.**
2. **A planner grid.** Children as rows, weeks of summer as columns. A parent drops camp sessions into cells and immediately sees four things: weeks with no coverage, two sessions overlapping for one child, camp hours ending before the workday does, and two children at camps too far apart for one drop-off run.

**The grid is the differentiator. The directory is table stakes.** Existing Richmond camp directories are paid-listing ad pages — no map, no filters, no dates, no way to plan across multiple children.

## Two horizons, one question

Summer is the primary case and it earns the grid: twelve contiguous weeks, several children, real conflicts to resolve. But school also closes on roughly **eighteen other days a year** — holidays, teacher workdays, conference days, winter and spring break — and those are the ones that go unnoticed until the week before. A parent who does not observe Yom Kippur has no reason to expect their district to close for it.

Both horizons ask the same question: **is this day covered, and by whom?** They differ only in shape. Summer is dense and contiguous, so it is a grid. The scattered days are sparse, so they are a dated list — about eighteen rows, not a year-long calendar that is empty nearly everywhere.

**Summer leads the product.** The year-round view is the second surface, not the front door.

> **The model follows from this, and it changed.** The primitive is a **closure** — a contiguous run of days school is shut, with a reason — and summer is simply the longest one. Two dates could not express eighteen scattered days, so `SchoolCalendar` and `summerWeeks()` were replaced rather than extended (CAM-22). **[ADR-0013](./adr/0013-school-closures-as-the-coverage-primitive.md) is the decision and the reasoning; read it before touching `packages/planner/`, `school_calendars` or `school_closures`.**

Launch market is the Richmond, Virginia metro: Richmond city, Chesterfield, Henrico, and Hanover counties.

## How the work runs

Two people, part-time, building largely through AI coding agents. **Scope for any task comes from its Linear issue** — not from this file, and not from an agent's own reading of what the product needs next. `AGENTS.md` §0 covers the working style; the short version is that boring beats clever, and the gates in §1 are not optional.

## Where the reasoning lives

- **`AGENTS.md`** / `CLAUDE.md` — the engineering contract: TDD, PR flow, quality gates, product rules. **Read first.**
- **`docs/adr/`** — every significant decision and its rationale. Start with ADR-0002 (Supabase), ADR-0004 (RLS), ADR-0006 (child data), and ADR-0013 (the closure model).
- **`docs/DESIGN.md`** — the visual language: tokens, card anatomy, state signals, copy rules. Proposed throughout, and the only design reference an agent can actually open.
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
| `main` branch protection | on — PR required, 4 checks must pass, admins included |
| Toolchain — Biome · tsc · Vitest · Playwright · Lefthook · CI | wired and passing |
| Agent guards — TDD guard, privacy guard | installed, and tested against their own failure cases |
| Schema — catalog and household migrations, RLS on every table | applied to the live `campout` Supabase project (CAM-25) |
| `@campout/planner` — the closure model | shipped, covered at 100% |
| RLS policy tests | in place — two households, two JWTs, real Postgres in CI, and against the live project |
| CodeScene ratchet | wired to project 84686; floor at 9.90 / 9.80 against a measured 10.00 |

`packages/planner/src/weeks.ts` and its tests are the reference example of the loop this repo expects: pure, dates passed in as arguments, bad input refused loudly, fully covered. Read them before writing your first module here.
