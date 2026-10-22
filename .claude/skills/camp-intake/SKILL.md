---
name: camp-intake
description: Turn a camp's published source (a camps page, an activity finder, a brochure or flyer) into draft provider, camp, location, session and option rows in Supabase, and correct records we already hold (CAM-47). Use when given a camp or provider and its source and asked to add or correct it in the catalog. Stops once, at a checkpoint, before writing anything; writes drafts only, never a publish.
---

# Purpose
Reads a camp's own pages — the part no deterministic parser should be trusted with, because every camp publishes differently — and turns them into an **intake plan**: the rows to draft and the corrections to make, in the shape `src/lib/catalog/intake/plan.ts` defines. The local script `scripts/camp-intake.ts` previews the plan at the run's one checkpoint and, once the owner has confirmed it, writes it with the secret key.

Everything it writes is a `draft` (ADR-0017 §1). Parents see nothing until a reviewer approves each record from its card on `/camps`. The script cannot publish: the plan's types have no status field, and the guard trigger refuses any write that would verify a row. **The database's constraints are the only check on the facts.** There is no validator of our own: a rule the database checks only at approval (a session with no option, one over 14 days) is caught when the owner approves.

Read `docs/data/camp-record-spec.md` before every run. It defines every field; this skill does not repeat it.

# When to use
- A new camp, a new provider, or sessions we missed, from a source we can cite.
- A source that disagrees with a record we hold (a renamed camp, a changed price).

Not for duplicate clean-up beyond the run's own match proposal, or bulk entry through a form: both belong to the review queue (CAM-3).

# Inputs
- **The source**: a URL, or a local file (a brochure PDF, a photo of a flyer).
- **The provider**, if we may already hold it. `pnpm camp:intake held <name>` prints what we hold for it.
- **A Linear ticket**, if given. Read its TC first: it carries what earlier runs learned about this source.

# Running the script
The script reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` from `.env.local`. In a worktree, which has no `.env.local`, point it at the main checkout's:

```bash
pnpm exec tsx --env-file=<main checkout>/.env.local scripts/camp-intake.ts <command> [< PLAN_FILE]
```

| Command | Does |
|---|---|
| `held PROVIDER_NAME` | Prints the provider, its camps, sessions and options, and their locations, as JSON. |
| `plan < PLAN_FILE` | **The checkpoint.** Prints proposed matches, differences, records an update would put back to draft (with plan-entry counts), and what would be drafted. Writes nothing. |
| `plan --yes < PLAN_FILE` | Writes, then prints the run report. Refuses to write anything while a proposed match is unanswered. |

Plans live in `scratch/intake/`, which git ignores: the database is the only copy of the data (ADR-0017 §1). Name them `<provider-slug>-<YYYY-MM-DD>.json`.

# Rules
These start from the spec and grow by retro (§ Workflow 8). Each rule learned from a run names the source it came from.

1. **Facts, never wording** (ADR-0010). Dates, hours, ages, grades, prices, addresses, categories. A camp's `summary` is two sentences we wrote. `details` holds facts in the fixed vocabulary (spec → `details`); an unknown key is refused by the database. The only wording kept is `eligibility_wording`.
2. **Evidence is the exact page.** Each record's `source` is the page its own facts came from — the sessions page, not the home page. When there is no durable URL (a flyer, a PDF behind a redirect, a page that changes in place), save a copy, list it under `documents` (`path` in `camp-sources`, and the file's bytes as `base64`: write the plan with a short script, never paste the bytes), and give the record `{ "documentPath": … }`.
3. **Check `robots.txt` before fetching**, and stay within it. A JavaScript app (an activity finder) needs a real browser. Anything behind a login is not ours to publish.
4. **A session meets every weekday of its range** (spec → Scope). Split anything else, or skip it with a reason. Evening and weekend offerings and on-demand days are not listed. A session over 14 days is usually a mistake; ask.
5. **Never fill a fact the source does not state.** Hours, care times, ages and prices stay blank rather than defaulted. If you checked and the camp offers no early drop-off, that is a blank too — but only after checking. A blank the owner could not answer goes in `blanks` with the question.
6. **A session missing a required fact is not drafted.** It goes in `skipped` with the reason (`"no dates stated"`), and the report lists it.
7. **Money is integer cents; a time-limited discount goes in `price_note`**, never in the price.
8. **Write times as `HH:MM:SS`** in updates, the way `held` prints them, or every time shows as a difference.
9. **DaySmart activity finders render only in a browser** (SCOR, 2026-10-21). Each level (Full Day, Half Day AM, Half Day PM, …) is its own listing, ten results a page, and the price shown is a day rate. A session cites its level's URL, `season_id` included; a week offered several ways cites the full-day level.
10. **A record we hold sets the shape** (SCOR, 2026-10-21). New sessions under a held camp follow the held sessions' structure — SCOR's carry one full-day option with half days in its `price_note` — unless the owner says otherwise at the checkpoint.
11. **A camps page can keep last year's section** (SCOR, 2026-10-21: its January–April holiday dates fit 2025-26). Check that every date falls on a weekday in the target year before drafting it; a list that doesn't is stale, and is skipped with that reason.
12. **"JWT issued at future" from the script is clock skew** (SCOR, 2026-10-21). Nothing was written; wait a few seconds and run it again.

# Workflow

## 1. Gather context
Read the ticket's TC if given. Run `held` for the provider. Note which records we hold, their status, and their ids.

## 2. Fetch the source
Check `robots.txt`. Fetch the page, in a browser if it is a JavaScript app. Decide whether its URL is durable enough to cite; if not, save a copy (Rule 2).

## 3. Extract into a plan
Write `scratch/intake/<provider-slug>-<date>.json`, an `IntakePlan`:

- `providers`, `locations`, `camps`: each either `{ ref, existing: <id> }` for a record we hold, or `{ ref, source, facts }` to draft. A new location also carries `coordinates: { lat, long }`, or `null` until the owner supplies them. A new camp names its `providerRef`.
- `sessions`: `{ ref, campRef, locationRef, source, facts, options: [...] }`, one to three options (`full_day`, `morning`, `afternoon`), each with its price.
- `updates`: `{ kind, id, sourceUrl, proposed: { field: value }, approved: [] }` for each record the source disagrees with. `approved` starts empty. Updates apply in order, so move sessions (`camp_id`) before archiving the camp they left (`{ "status": "archived" }`, a status-only change the guard allows; `verified` it refuses).
- `skipped`, `blanks`: as Rules 5 and 6 say.

Refs are names you choose (`scor-summer-camp`, `jul-13`), unique per kind. The report prints them.

## 4. Preview
Run `plan < PLAN_FILE` without `--yes`. Fix any error that is a bug in the plan (a ref that names nothing) before going on.

## 5. The checkpoint — stop once, and write nothing
Show the owner, in one message:

- **Matches.** Every proposed match, with your recommendation. A confirmed match becomes `{ ref, existing: <id> }`, and new camps and sessions go under it. A rejected one goes in that record's `distinctFrom`.
- **Coordinates.** For each new location, ask for its latitude and longitude. There is no geocoder (CAM-45); never guess a pin. A location is not drafted without them: the database refuses a null point.
- **Open questions.** Each fact the source leaves ambiguous. An answer goes into the facts; no answer goes in `blanks`.
- **Differences.** Each as field · ours · source · source URL. Nothing changes without the owner's yes for that field, which goes in `approved`.
- **Put back to draft.** A verified record is corrected by putting it back to draft (`reviewer_edit()` needs a signed-in reviewer; a secret-key run has none), and the owner re-approves it from its card. Say how many plan entries that hides, from the preview: a planned session no longer listed can break a family's page (CAM-49).
- **Skips.** What you will not draft, and why.

**Wait for the answers.** Then apply them to the plan and preview again. The preview must show no unanswered match; the script refuses to write until it does.

## 6. Write
Run `plan --yes < PLAN_FILE`. **The first row the database refuses stops the run**, with the database's words, and everything before it stays as drafts. Do not retry on your own: show the owner the refusal and the report, and ask. A re-run proposes the drafts just written as matches, so confirm them as `existing` rather than drafting them twice.

## 7. Report
Show the run report: what was drafted, what was updated, what was skipped and why, and which facts were left blank. Then tell the owner what to approve, top down from the card: provider and location, then camp, then session. Name each record that was put back to draft.

## 8. Retro
Ask the owner: *"Should anything from this source become a rule in this skill?"* If yes, add it under **Rules**, naming the source, and commit it with the run's ticket. A one-off quirk goes in the ticket's TC instead.
