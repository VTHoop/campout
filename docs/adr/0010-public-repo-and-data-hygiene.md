# 10. Public repository and data hygiene

- Status: Accepted
- Date: 2026-09-14

## Context
The repo is public. That buys the free tiers of CodeScene and Codacy — the two gates ADR-0005 leans on hardest — and makes the project a portfolio piece.

It also means every commit is permanent and world-readable. A secret pushed and then deleted is still in the history. Real child data committed to a fixture is a real child's name in a public repository, forever.

Three specific hazards follow from a public repo in *this* domain, and none of them applies to the sibling project.

## Decision
**The repository is public.** Three rules follow, all cardinal.

### 1. No real family data, ever
Seeds, fixtures, and tests use **invented households and invented children**. The founders are building this for their own families, which makes their own kids the most convenient test data available and the single worst thing to commit. Fixtures are named after fictional families and nothing else.

### 2. No credentials, and rotate rather than delete
Supabase and MapTiler keys live in `.env.local`, which is gitignored, and in Vercel's environment settings. `.env.example` carries names with no values.

**A committed secret is rotated, not deleted.** Deleting the line removes it from the working tree and leaves it in the history, where it is trivially recoverable. `trivy`'s secret scanning runs on the whole repo via Codacy and a finding is release-blocking (AGENTS.md §1).

The **service-role key** is the one that matters most: it bypasses every RLS policy (ADR-0004). It never enters application code, a browser bundle, or a request-serving runtime.

### 3. Facts, not prose
Camp records store **facts** — dates, ages, hours, prices, addresses, categories. Facts are not copyrightable.

**⛔ Never bulk-commit scraped camp marketing copy** into the repo or the database. A short factual summary we wrote is fine; a camp's description pasted verbatim is someone else's copyrighted text in our public repo. When fetching, respect `robots.txt` and rate limits — we read a few hundred pages a year and should be invisible while doing it.

## Consequences
- **+** CodeScene and Codacy run free on every PR.
- **+** A public artifact demonstrating the engineering discipline.
- **−** The camp dataset and the tooling around it are visible to anyone, competitors included. Accepted: the defensible asset is *verified, current* data and the planner, neither of which is copyable from a schema.
- **−** Zero margin for error on secrets and fixtures. This is why the rules above are cardinal rather than advisory.
