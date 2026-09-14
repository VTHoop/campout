# 1. Record architecture decisions in ADRs

- Status: Accepted
- Date: 2026-09-14

## Context
Campout is greenfield and built largely by AI coding agents. Two failure modes threaten a project shaped like this. The first is relitigating settled questions, which is expensive on a small time budget. The second is an agent making a structural choice in isolation because nothing in the repo told it one had already been made.

## Decision
We record significant decisions as Architecture Decision Records (Michael Nygard format) in `docs/adr/`, numbered sequentially.

- Created in the **same commit** as the change they describe.
- **Immutable** — never edit an accepted ADR; supersede it with a new one that references it.
- Written for: a new dependency, storage/data strategy, platform target, core abstraction, cross-cutting pattern, or a privacy/liability call. Not for bug fixes, styling, or routine refactors.

Format: `Status · Date · Context · Decision · Consequences`.

Privacy and liability decisions get the same treatment as technical ones. In this domain they *are* architecture — ADR-0006 constrains what code may exist as firmly as any framework choice.

## Consequences
- An agent opening this repo cold can reconstruct the reasoning without asking.
- Small per-change overhead; mitigated by keeping ADRs short.
- The supersession chain documents how thinking evolved, which matters because the January beta will teach us things the brief could not.
