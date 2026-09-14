# 5. Engineering process & quality gates

- Status: Accepted
- Date: 2026-09-14

## Context
This codebase is written largely by AI agents, by two people with very little time, and it is public. Agents fail in a specific and well-documented way: when a test blocks progress, the cheapest path to green is to change the test. Every gate below exists because some agent, somewhere, took that path.

The process below is proven rather than invented. It is adopted wholesale because the time to design a new one would be better spent building.

## Decision
The full contract lives in `AGENTS.md`. Key points:

- **TDD mandatory** — red → green → refactor, one cycle per commit, failing regression test first for bugs. **The human owns the assertions.** Agents may not weaken or delete tests to pass. Commit the failing test as a checkpoint so cheating is visible in git history.
- **Test integrity is machine-enforced**, not merely documented. A `PostToolUse` hook (`.claude/hooks/tdd-guard.sh`) inspects every `Edit`/`Write` and blocks the turn on: an added `.skip`/`.only`, a removed test case or `describe` block, net-removed assertions in a test file, or a lowered coverage threshold. Documentation an agent can ignore is not a gate.
- **Light PR flow** — a PR per task even solo, with the `/code-review` agent plus Codacy and CodeScene checks visible in PR history; squash-merge to `main`.
- **Quality gates:** ratcheting **CodeScene** code-health, **Codacy** security, and **Vitest** coverage with two floors — 95% on `packages/planner` (pure functions, and the whole product claim) and 80% on `src`. Never bypass (`--no-verify`) or lower a gate.
- **RLS policy tests are a gate of the same rank as the test suite** (ADR-0004), because the failure they prevent is a privacy incident rather than a bug.
- **Linear** for issue tracking; completion comment per issue.
- **Proportionality:** we deliberately defer Codecov, SonarQube, and a staging environment until team size or scale warrant them.

## Consequences
- **+** Agent output we are willing to point a family's data at.
- **−** Per-change overhead, which is real on a small time budget. Justified: the alternative is debugging agent-written code with no safety net, which is slower.
- **−** CodeScene and Codacy need one-time account setup. Free, because the repo is public (ADR-0010).
