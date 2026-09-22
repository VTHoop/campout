# AGENTS.md — Campout

A planning app for working parents covering every day school is closed: a verified local camp directory plus a planner grid that shows which weeks of summer — and which scattered days off through the rest of the year — are still uncovered. Summer leads; the year-round view is the second surface. Launch market is the Richmond, Virginia metro (Richmond city, Chesterfield, Henrico, Hanover). Built largely with AI coding agents — this file is the contract every agent (and human) follows.

> **Status:** greenfield. The toolchain is wired and enforcing — Lefthook `pre-commit` (Biome + typecheck) and `pre-push` (lint, typecheck, CodeScene delta, coverage), the TDD guard and privacy guard hooks on every `Edit`/`Write`, and CI (lint · typecheck · coverage · RLS policy tests · Playwright smoke) plus the CodeScene and Codacy bots on every PR. Treat every command below as live and binding.
>
> **`main` is protected, and the gates below can block a merge.** Direct pushes are rejected — including from repository admins. A change reaches `main` only through a PR with four checks green: `Lint · Typecheck · Coverage`, `RLS policy tests`, `Playwright smoke`, and `CodeScene Code Health Review`. Force pushes and branch deletion are off, history must stay linear (squash-merge), and open conversations must be resolved. Approvals are **not** required, so a solo PR can be merged by its author — the PR exists as the visible record of review discipline, not as a bottleneck.

---

## 0. Working style

**This is a small team on a small time budget.** Two people, part-time. That is not a licence to skip the gates in §1 — it is the reason they exist, because there is no slack to spend debugging agent-written code with no safety net.

It does mean one thing about technical choices: **boring beats clever.** When two approaches both work, take the one with fewer moving parts, even when the other is more interesting. A dependency, a service, or an abstraction you add is one somebody has to keep working.

**Scope comes from the Linear issue, not from this file and not from your own judgment about what the product needs next.** If a task seems to call for work outside its issue, say so and stop — do not widen it.

---

## 1. Development Process

### Starting a task
- Read the **Linear** issue and all comments fully (`mcp__linear__get_issue`, `mcp__linear__list_comments`). The issue is the source of truth for scope.
- Check `docs/adr/` for relevant architecture decisions before any structural choice.
- Check `docs/ARCHITECTURE.md` and `docs/ABSTRACTIONS.md` for existing structure and patterns.
- For any work touching camp records: read `docs/data/camp-record-spec.md` first. It defines every field, what counts as verified, and what must never be stored.
- For UI tasks: study the existing visual language and components first. **Reuse before recreating** (components, hooks, tokens).
- Post a Linear comment: `🚀 Starting: <brief approach>` (`mcp__linear__save_comment`).

### Branches & PRs (light PR flow)
- One short-lived branch per task: `feat/…`, `fix/…`, `refactor/…`. Branch off `main`.
- Open a **PR** for every change, even solo. Keep PRs small and single-purpose — the PR is the visible record of review discipline.
- The PR must show: passing check suite, a Challenger pass (the Automatic Code Review Protocol below — **not** the `/code-review` skill; that one's a heavier, optional tool, never a required gate), and green Codacy + CodeScene checks.
- Squash-merge to `main`. Delete the branch.
- **A task is not done until the PR is merged and the issue's completion comment is posted.**
- **⛔ NEVER `--no-verify`.** If a hook blocks you, read the error and fix the code — never bypass, never lower a gate.

### TDD (mandatory)
**Red → Green → Refactor → Commit.** One cycle per commit.
- **You (the human) own the assertions.** The agent must not invent the spec it grades itself against. Tests encode behavior we decided, not behavior the agent prefers.
- For bugs: write the failing regression test **first**, then fix.
- **Commit the failing test as a checkpoint** before implementing, so cheating is visible in history.
- **⛔ NEVER modify, weaken, or delete a test to make it pass.** If a test is wrong, fix it in its own commit with a stated reason.
- Drive to green without touching the committed tests; then refactor with the suite as the safety net.
- **Don't just "do TDD" procedurally** — give the agent the *contextual* test signal (which tests cover the change). Surface coverage of the touched area, not a ritual.
- **Test quality (Beck's desiderata):** Isolated · Deterministic · Fast · Behavioral · Structure-insensitive · Specific · Predictive. Fix flaky tests before anything else.
- **Dates and times are the flakiness risk in this codebase.** Never call `new Date()` with no argument inside a planner function or a test — pass the clock in. A test that passes in September and fails in July is the exact failure this rule exists to prevent (see Code conventions → *Time is data, not ambient*).
- Exception: pure styling/layout changes.

### Check suite (runs in CI on every PR; run locally before pushing)
```bash
pnpm lint          # Biome (format + lint); zero warnings
pnpm typecheck     # tsc --noEmit — the single best correctness signal for LLM-written code
pnpm test          # Vitest
pnpm test:coverage # Vitest v8 coverage — thresholds in vitest.config.ts, ratcheted
pnpm e2e:smoke     # Playwright smoke lane — must stay under 5 minutes
```

Coverage is a **release gate, not a vanity metric.** Two floors, because two kinds of code:

| Scope | Floor | Why |
|---|---|---|
| `packages/planner/**` | **95%** | Pure functions, no I/O, and the whole product claim. A coverage gap here is a gap in the thing we are selling. |
| `src/**` | **80%** | React and route handlers; meaningful coverage on data paths beats padded coverage on layout. |

Both are ratchets that only move upward (`thresholdAutoUpdate` stays off; the TDD guard hook blocks any edit that lowers a threshold). Clearing the floor is not the goal — meaningful coverage on the coverage analyzers and the RLS boundary beats padded coverage on trivial branches.

### Row Level Security is a tested boundary, not a checkbox
Supabase RLS policies are the *only* thing standing between one family's children and another's (ADR-0004). A policy is code, and untested policy code is a privacy incident waiting to happen.

- Every table holding household or child data ships with policy tests **in the same PR as the table**.
- Tests run against a local Supabase instance with **two real households and two real JWTs**, and assert the negative case: household B gets zero rows, not an error, when reaching for household A's children.
- **⛔ NEVER use the service-role key in application code.** It bypasses every policy. It belongs to migrations and to local seed scripts, and it never reaches a browser bundle or a Vercel runtime that serves user requests.
- A new table with RLS disabled is a release-blocking bug. `supabase/migrations/` must enable RLS on every user-data table in the migration that creates it.

```bash
pnpm supabase:start   # local Postgres + Supabase services (Docker)
pnpm test:rls         # policy suite against the local instance
pnpm supabase:reset   # re-apply all migrations + seed
```

### Code health — CodeScene (free OSS tier, public repo)
Two surfaces that answer different questions.

**1. The PR bot — relative.** The CodeScene GitHub app posts a Code Health Review on every PR, evaluating the *change* against `main`. **Read what it flags and address it.**

**Reproduce it locally before pushing.** The [`cs` CLI](https://codescene.io/docs/cli/index.html) runs the same analysis the bot does:

```bash
cs delta main                       # what the PR check will say — run this before pushing
cs check path/to/file.ts            # one file's code health score (1–10)
cs review path/to/file.ts           # the score plus the specific findings
cs delta --staged                   # only what's staged
```
A new file must score **10.00** to clear the "New code is healthy" gate, and per-rule deductions are fixed — a partial fix scores the same as no fix, so eliminate a flagged rule entirely rather than easing it. Do not push blind and read the bot; it is a ~60s round trip that `cs delta main` answers in seconds.

`pre-push` runs `cs delta --error-on-warnings main` for you, so a finding blocks the push. It *skips* if the CLI or token is missing rather than blocking a fresh clone — so a passing hook with neither installed means nothing was checked.

**2. The ratchet — absolute.** `.codescene-thresholds` commits a floor for the whole repo's aggregate score, enforced by `scripts/check-code-health.ts` after every merge to `main`. This exists because the PR bot stays green while the repo slides downward one acceptable PR at a time; only the aggregate catches that.

```bash
pnpm codescene:check            # grade the last analysis CodeScene ran
pnpm codescene:check --refresh  # analyse current main first, then grade (~75s)
```
Needs `CS_ACCESS_TOKEN` — a free personal token from https://codescene.io/users/me/pat, kept in `.env.local` (see `.env.example`) and stored as a GitHub Actions secret.

- **The floor only moves upward.** Raise it deliberately after a sustained improvement. **⛔ NEVER lower `.codescene-thresholds` to make a build pass** — that is the same offence as weakening a test.
- **Boy Scout Rule (binding, judged by eye):** every file you touch should leave more readable than you found it — smaller functions, fewer branches, clearer names. You don't need a score to know when you've made a function worse.
- **⛔ NEVER add `biome-ignore`, `// @ts-ignore`, or `as any` to dodge a finding.** Fix the code.
- **⛔ NEVER use the Suppress link CodeScene offers next to a finding.** It is one click and it is always the wrong click.

### Security & static analysis — Codacy (mandatory)
The Codacy GitHub app posts a static-analysis check on every PR, and CI uploads coverage to it. Locally, [Codacy CLI v2](https://github.com/codacy/codacy-cli-v2) is free and needs no account or token — configured by the committed `.codacy/codacy.yaml`.

```bash
codacy-cli install                        # once, after cloning — pulls the pinned tools
codacy-cli analyze --tool trivy           # secrets + dependency CVEs (whole repo)
codacy-cli analyze --tool opengrep src/   # security patterns, 80+ rules over TS
```
- Run both **before marking a PR ready**. They are fast and need no network beyond the first install.
- **Always fix Critical & High findings introduced by your change** before requesting review.
- Review Medium findings: fix real defects/security issues; otherwise justify in the completion comment.
- Never silence a rule to pass — remove the finding with a small code change.
- **TSQLLint is disabled for this repository, deliberately.** Codacy runs a T-SQL (SQL Server) linter against every `.sql` file and cannot tell which dialect it is reading. On our Postgres migrations it raised *"Expected SET QUOTED_IDENTIFIER ON near top of file"* — a statement that does not exist in Postgres and would break the migration if added. There is no code change that satisfies it, so the tool is switched off in Codacy's repository settings.
  - **This is not a silenced rule and must not be treated as precedent.** The rule was not wrong about our code; it was the wrong language. Every other Codacy finding gets fixed in the code, never suppressed (see the two rules above this one). If you find yourself reaching for this paragraph to justify turning something off, you are almost certainly not in the same situation.
- **The local CLI is a subset of the PR bot, not a replacement.** The CLI's ESLint install ships no TypeScript parser, so ESLint is excluded from `.codacy/codacy.yaml`; the server-side `codacy-eslint` the bot runs does analyse TypeScript properly, including `security/detect-object-injection` (the **Generic Object Injection Sink** — see Code conventions). A clean local run does **not** imply a clean Codacy check. Read the bot.
- **`trivy`'s secret scanning carries real weight here.** This repo is public and holds Supabase and MapTiler credentials. Treat any secret finding as release-blocking, and rotate the key rather than only deleting the line — git history keeps what you pushed.

### Code conventions
How we write code, as distinct from the gates above that catch us not doing so.

- **Enums over magic strings.** A finite set of internal values is a **TS string enum** (`export enum CampCategory { Sports = 'sports', … }`), not an inline string-literal union. Callers get a named symbol, not a quoted string to typo.
  - **The one exception is the database layer.** Postgres `CHECK` constraints and Postgres enum types own the persisted domain, and the generated Supabase types reflect them. Where a database domain and a TS enum describe the same set, **One layer owns a domain** below governs.
- **No computed member access.** Never `obj[key]` with a non-literal key — a variable index, a `for…of` over a key list. Codacy flags every one as a **Generic Object Injection Sink**. Three shapes cover every case:
  - **id / dynamic-key lookup** → a `ReadonlyMap`.
  - **an exhaustive keyed table** → declare the object literal with `satisfies Record<Key, V>` so a missing key is still a compile error, then read it through a `Map` built from `Object.entries`. Exhaustiveness and injection-safety are not a trade-off.
  - **a small fixed field set** → just write the reads out, one per line.
  - **The tell:** if you're writing `as Record<string, T>` to make an index compile, you are about to introduce this finding *and* you have just turned off type checking on that read.
- **Structural over remembered.** When an invariant can be expressed so that breaking it fails to compile — or so the offending code has no access path at all — express it that way instead of documenting it and trusting everyone to remember. This is the main defence for both cardinal rules below:
  - The `Child` type has **no field** for a last name, a birth date, or any health information, so no code path can persist one (Product Rules → Child data).
  - The browser-only form-fill vault lives in `src/lib/vault/` and its types are **never imported by server code**; a `server-only` import guard makes a mistake a build error rather than a leak (ADR-0006).
  - A `Camp` read model with no `verifiedAt` cannot be constructed, so nothing unverified can reach a page (Product Rules → Data provenance).
- **Refuse rather than guess.** A record that is internally inconsistent is a bug, not an input — throw. Never default past it, optional-chain around it, or substitute a placeholder. A camp session that renders but is wrong is worse than a loud failure, because a parent plans their summer around it and may pay a non-refundable deposit. A session whose `endDate` precedes its `startDate`, or whose district calendar is missing for the planning year, must throw rather than render.
- **One layer owns a domain; every mirror is guard-locked.** The **database is the source of truth** for anything persisted — the generated types in `src/lib/db/types.ts` come from the schema, never hand-written. Where `packages/planner` needs one of those domains, tie its enum to the generated type with a compile-time `AssertEqual` guard so the two cannot drift.
- **Time is data, not ambient.** Every function that reasons about dates takes the date it needs as a parameter. **⛔ NEVER call `new Date()` with no argument inside `packages/planner`.** Related rules, all learned from this problem domain:
  - **Camp dates are calendar dates, not instants.** Store `date` in Postgres and handle as `YYYY-MM-DD` strings. A camp that runs June 15–19 runs those days in Richmond regardless of the reader's timezone; converting to a UTC instant moves it a day for half the country.
  - **Daily hours are wall-clock `time` values**, compared against the household's workday in the same wall-clock space. No timezone math.
  - **Money is integer cents.** Never a float. `price_cents`, always.
- **The planner is pure.** `packages/planner` has no database client, no `fetch`, no React, no environment access. It takes plain data and returns plain data. This is what lets the coverage analyzers run identically in a route handler and in the browser as the parent drags a session into a cell — and it is what makes 95% coverage cheap instead of painful.

### PR-readiness checklist → completion comment on the Linear issue
Before marking the issue done, post a comment covering:
- **What** was implemented (logic + UX, a few lines).
- **Tests/coverage:** commands run, final coverage on changed code.
- **RLS:** policies added or changed, and the negative-case tests proving them — or "none".
- **CodeScene:** what the PR bot's Code Health Review flagged, and what you did about it (or "clean").
- **Codacy:** the PR check's result, plus the local `trivy` / `opengrep` runs; confirm no new Critical/High.
- **ADRs:** new/updated, or "none".
- **Docs:** updated `ARCHITECTURE.md`/`ABSTRACTIONS.md`/`camp-record-spec.md`, or "none".
- **Data hygiene:** confirm no real family data, no child PII, and no credentials were committed (see Product Rules).

### ADRs & docs
- ADRs live in `docs/adr/`, created **in the same commit** as the code. **Never edit an existing ADR — supersede it** with a new one.
- **When:** new dependency, storage/data strategy, platform target, core abstraction, cross-cutting pattern, privacy/liability call. **Not for:** bug fixes, styling, refactors.
- After any new table, migration, RLS policy, component/hook, or integration: update `docs/ARCHITECTURE.md` / `docs/ABSTRACTIONS.md` in the same commit.

### Working with multiple agents
This workflow is multi-agent-ready: the writer agent and an independent reviewer/QA agent must not be the same context. Use the Challenger (Automatic Code Review Protocol, below) for adversarial review against the issue spec — the author never grades its own work. Background loops are assistants, **not** a substitute for fixing your own regressions before merge.

### Automatic Code Review Protocol

**This is the required review gate — the only one.** Nothing else in this file requires the `/code-review` skill, `/self-review`, or any other review tool. Those are heavier, optional passes to reach for on a large or risky change; they are never what "PR must show a review pass" means, and running one does not replace this protocol.

After completing code edits in a turn, you MUST run the following review cycle before presenting results to the user. This is not optional.

**Skip this cycle only if:** the turn contained no code edits (reads, searches, planning, or conversation only).

#### Step 1 — Spawn the Challenger
Use the Agent tool with `subagent_type: "challenger"`. The agent definition lives at `.claude/agents/challenger.md`. Provide it:
- The files you edited (paths)
- A summary of what you changed
- The **artifact type** (e.g. React Server Component, route handler, SQL migration, RLS policy, planner module, Vitest suite, Playwright spec, config file, markdown workflow spec)

The challenger is read-only (no Edit/Write) and will return either `LGTM` or a single specific concern.

#### Step 2 — Arbitrate yourself
Evaluate the challenger's concern directly. You have full context the challenger does not. Rule on:
1. Is the concern valid and worth addressing?
2. If yes: what specifically should change and why?
3. If no: why is the original approach correct?

#### Step 3 — Act on the ruling, then output a findings summary
- If you sided with the challenger: implement the fix immediately.
- If you sided with your original approach: note why the concern was dismissed.

Then present your work to the user followed by a **Review Findings** block in this format:

```
---
**Review Findings**
- **Challenger:** [one sentence — the concern raised]
- **Ruling:** Upheld / Dismissed
- **Reason:** [one sentence — why]
- **Action:** [what was changed, or "none"]
---
```

---

## 2. Product Rules

### Child data (cardinal)
We store **as little about a child as a planning grid can function on**: a first name or nickname, an age, and a grade. That is the whole list.

- **⛔ NEVER add a column, field, type, or form input for:** a last name, a date of birth, allergies, medications, dietary restrictions, diagnoses, IEP or 504 information, a photo, or any free-text note attached to a child. A free-text note is the leak — it looks harmless and it is where a parent types the allergy.
- Age is stored as an **integer year**, not derived from a birth date, because we do not have a birth date and must never acquire one.
- **This is a schema-level rule, not a UI-level one.** The `children` table and the `Child` type must make the forbidden field impossible, not merely absent. If a ticket asks for one of these fields, stop and escalate to the humans before writing the migration.
- **⛔ NEVER commit real family data.** Seeds, fixtures, and tests use invented households and invented children. The founders' own kids are real children in a public repo's git history otherwise, permanently.

### Sensitive family data stays in the browser (cardinal)
Camp registration forms want emergency contacts, insurance details, physician names, and medical history. Campout can help a parent fill those in **without ever holding them**.

- That data lives in **browser storage only** (`src/lib/vault/`, ADR-0006). It is never sent to Supabase, never logged, never included in an error report, and never present in a server component's props.
- The boundary is structural: vault types are not importable from server code, and a `server-only` guard turns a mistake into a build error.
- **If a ticket proposes syncing the vault across devices, that is a new ADR and a conversation with the humans — not an implementation detail.** Cross-device sync means server-side storage of exactly the data this rule exists to avoid.

### Data provenance & liability (cardinal)
**Campout lists camps. It does not vet, endorse, inspect, rank by quality, or recommend them.** This is a legal posture and a product rule at the same time.

- Every camp and every session carries a **`source_url`** and a **`verified_at`** timestamp, both required. A record missing either is not live and must not render.
- **Every record is verified by a human before it goes live.** No automated extraction ever publishes directly — anything automated feeds a review queue, and a human clears it.
- The camp page links out to the camp's own registration page. **Campout never handles registration or payment.**
- **⛔ NEVER write UI copy, ordering, or badging that implies vetting, safety screening, endorsement, or a quality judgment.** "Verified June 3, 2026" means *we checked these facts were accurate that day*, and the UI must say so in those terms. Sorting is by distance, date, or price — never by a Campout score.
- The `verified_at` date is shown to the parent on every session. Stale data in this domain is not a cosmetic problem: a parent who shows up to a camp that moved has lost a workday.

### Camp content & copyright (public repo)
- Store **facts** — dates, ages, hours, prices, addresses, categories. Facts are not copyrightable.
- **⛔ NEVER bulk-commit scraped camp marketing prose** into this repo or the database. A short factual summary we wrote is fine; a camp's description copied verbatim is not.
- Respect `robots.txt` and rate limits when fetching. We are a small operation reading a few hundred pages a year, and we should be invisible.

### UI
- **Read [`docs/DESIGN.md`](./docs/DESIGN.md) before building any UI.** Tokens, the session-card anatomy, state signals and copy rules live there. Everything in it is **proposed and expected to change during the MVP** — it is a starting point to work from, not a spec to defend. Navigation and information architecture are deliberately undecided; do not invent them.
- **Use shadcn/ui components.** No raw HTML form controls for user-facing UI (`<input>`, `<select>`, `<button>`, native date pickers). Search `src/components/` for an existing component before building a new one. New UI must feel native to the app — if it looks like a browser default, it's wrong.
- **Mobile-first.** A parent plans this on a phone at 9pm. The planner grid must work at ~400px, which is the hardest layout problem in this app — solve it first, not last.
- **Accessibility is not optional on the grid.** It is a table of real data; it gets real table semantics, keyboard navigation, and a non-color signal for every state. Coverage gaps must never be communicated by color alone.

---

## 3. Reference

### Stack

| Layer | Choice | Notes |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** on **Vercel** | Server components fetch camp data with the anon key server-side; route handlers host admin and server-credentialed actions. ADR-0003 |
| Database | **Supabase Postgres** | The relational core: camps, locations, sessions, school calendars, households, children, plan entries. ADR-0002 |
| Geo | **PostGIS** (`geography(Point,4326)`) + GiST index | "Camps within 10 miles of home" is one indexed `ST_DWithin`. ADR-0007 |
| Auth | **Supabase Auth** (magic link) | No passwords to manage for a family beta. The JWT drives RLS. ADR-0004 |
| Authorization | **Row Level Security** | The only boundary between households. Tested, not assumed. ADR-0004 |
| Files | **Supabase Storage** | Source PDFs captured at verification time, so we can prove what a camp said. |
| Planner | **`@campout/planner`** (pnpm workspace, `private: true`) | Pure TS, no I/O. The school-closure model (summer is derived, never stored), and the coverage analyzers. Runs in a route handler **and** in the browser. ADR-0008 |
| Maps | **MapLibre GL** + MapTiler tiles | Open-source renderer; the tile provider is swappable. ADR-0007 |
| Styling | **Tailwind v4** + **shadcn/ui** | Design tokens land with the first real UI. |
| Package manager | **pnpm 11**, Node 24 | `pnpm-workspace.yaml` for the planner package. |

### Data shape
Normalized relational, because the domain is relational and a human has to verify it by eye in Supabase's table editor.

**A `camp` is an organization. A `session` is a dated offering.** The directory searches *sessions* — a parent is shopping for "the week of July 13", not for an organization. A camp page lists its sessions. This distinction is the single most important thing to get right in the schema; nearly every planner query starts from `sessions`.

`camps → locations → sessions` with provenance (`source_url`, `verified_at`, `verified_by`) on camps and sessions. `households → children`, `households → plan_entries → sessions`. `school_calendars` is reference data — one row per school year per district, or per school — with its dated closures in `school_closures`, and it drives the entire coverage model.

### Diagrams
Prefer Mermaid (`flowchart`, `sequenceDiagram`, `erDiagram`, `stateDiagram-v2`). ASCII only for spatial wireframes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
