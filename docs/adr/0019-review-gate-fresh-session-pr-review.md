# 19. The review gate is a fresh-session `/pr-review`, not a per-turn challenger

- Status: Accepted
- Date: 2026-10-09
- Supersedes: [ADR-0005](./0005-engineering-process-and-quality-gates.md)'s review clause, *"Light PR flow — a PR per task even solo, with the `/code-review` agent plus Codacy and CodeScene checks visible in PR history"*, as far as it names the review. The PR flow, squash-merge, and the Codacy and CodeScene checks stand.

## Context
ADR-0005 named `/code-review` as the review. AGENTS.md later replaced it with the challenger: a Haiku subagent the author spawned after every code-editing turn, which returned one concern that the author then ruled on. Across PRs #1–#24 the recorded results were 9 LGTM, 6 concerns dismissed and 3 acted on (#20, #21, #22), and #24 recorded no pass at all. Meanwhile the review that actually gated merges was `/pr-review`, run by the owner from a separate session — and it was written down nowhere.

The challenger's low yield follows from its shape, not from bad luck:

- **The author arbitrates.** The agent that wrote the code decides whether the objection stands, so the cheap path is dismissal — the same failure ADR-0005 exists to close for tests.
- **One finding, from the smallest model, mid-task.** It reviewed half-finished work after every turn instead of the finished change against its issue.
- **It cannot grow into the real review.** Subagents cannot spawn subagents, so a review run from inside the author's turn can never be the multi-lens one.

The handoff around the real review was manual too: the owner pasted `/pr-review`'s output into the implementing session, and that session — the author again — validated the findings.

## Decision
- **The required review is `/pr-review`, run from a session that did not write the code**, once the PR is open with checks green. It reviews the whole diff against the Linear issue across six lenses, validates every Blocker and Major against the diff before reporting it, and posts its result to the PR.
- **The implementing session answers the review from the PR, not from pasted text** (`/address-review`). A finding that survived validation is presumed valid: fix it test-first, or dismiss it with evidence — a passing test, a query result, a cited line — in a PR reply. A dismissal without evidence is not a dismissal. Work outside the issue is deferred to the owner, not absorbed.
- **Fixes are re-reviewed.** `/pr-review` runs again after them. A PR merges when the latest review is Approved, or every remaining finding is either dismissed with evidence the owner accepts or deferred to a follow-up issue the owner has created. **The owner arbitrates contested dismissals and deferrals; neither agent does.**
- **The per-turn challenger is removed.** The two `PostToolUse` hooks remain the per-edit checks: they are deterministic, which is the property a per-edit check needs.
- **The AC are the assertions.** ADR-0005 says the human owns the assertions. That is made concrete: every refined AC bullet maps to a test, the owner approves the map before the first red test (`/start-ticket`), and the PR body carries it for review.

## Alternatives considered
- **Keep the challenger, on a stronger model.** Fixes the model, not the arbitration: the author would still rule on its own reviewer.
- **Have the implementer run `/pr-review` on its own PR.** The six reviewers would be fresh, but validation and ranking would happen in the author's context — the step where a finding gets dropped.
- **A coordinator agent that drives every step.** Deferred, not rejected. It needs each step to read its inputs from durable state (Linear, the PR) first, which this ADR establishes; and because subagents cannot spawn subagents, its steps would have to run as separate headless sessions with pre-granted permissions.

## Consequences
- **+** No context grades its own work, and no dismissal leaves the PR without evidence the owner can check.
- **+** One review per PR round instead of one per turn, and no copy-paste between sessions.
- **−** Nothing reviews mid-task, so a wrong direction is caught at PR time rather than at the turn that took it. The approved AC → test map, the committed red tests and the hooks are what narrow that window.
- **−** `/pr-review` and `/refine-ticket` are user-level skills (`~/.claude/skills/`), not in this repo. A second contributor installs them as an onboarding step; that is not a reason to keep a weaker gate in-repo.
