# 17. Catalog storage: drafts live in the database, facts split into columns and details

- Status: Proposed
- Date: 2026-09-28
- Supersedes, once accepted: [ADR-0012](./0012-provenance-url-or-stored-document.md)'s *"`verified_at`, `verified_by` — still `NOT NULL`, always"*, and [ADR-0002](./0002-database-platform-supabase.md)'s *"The Supabase table editor is the camp verification tool."* The rest of both stands, including that provenance evidence is a URL or a stored document and never neither.

## Context
Catalog and calendar data do not live in the database yet. The camp catalog is a TypeScript mock (`src/lib/catalog/mock-data.ts`, CAM-1), and the school calendars are parser drafts (`docs/data/school-calendars/*.draft.ts`, CAM-23) that the Summer page reads directly. The live Supabase project has the schema and no rows.

The path planned from there has four hops: draft file → PR diff → seed → promote to the live project, with a separate ticket to switch each reader to Postgres (CAM-27, CAM-28, CAM-4). Every hop is somewhere a record can drift, and none of them shows a reviewer the record as a parent will see it. The schema also makes that impossible once the data moves: `verified_at` is `NOT NULL`, so an unverified row cannot exist in the database at all. The only place to look at a draft is outside it.

Filling in one real camp from its own pages (acac Midlothian, PR #19) showed the second problem. A camp states things a parent reads but never filters by: a field trip each week, some split by grade band; daily swimming; a free week-switching deadline; a card surcharge. Every camp's set is different. A column for each would make the tables mostly empty, and each new column would need a migration and a review.

## Decision

### 1. The database is the only home for catalog and calendar data, drafts included
`camps`, `sessions` and `school_calendars` gain a `status`: `draft`, `verified` or `archived`. Locations and closures follow their parent row.

- **Evidence is required from the first write.** `source_url` or `source_document_path` stays mandatory on every row, drafts included (ADR-0012). A draft comes from somewhere.
- **Verification is required only to be verified.** `verified_at` and `verified_by` become nullable, and a check constraint requires both whenever `status = 'verified'`.
- **The TypeScript mock and the calendar draft files are imported once, as drafts, and then deleted.** After that no second copy of the data exists. Tests and local development use an invented seed dataset (ADR-0010).

### 2. Visibility is enforced by RLS, not by application code
- The `anon` and ordinary `authenticated` roles read **only `verified` rows**. The catalog's "world readable" policies become `status = 'verified'`.
- A **reviewer** also reads drafts. Reviewers are listed in a `reviewers` table keyed by auth user, checked through an `is_reviewer()` helper in the same shape as `is_household_member()` (ADR-0004).
- **Approval goes through a `SECURITY DEFINER` function**, as household creation does (ADR-0011). It checks `is_reviewer()` itself, sets `status`, `verified_at` and `verified_by`, and has no other effect. No reviewer gets a general `UPDATE` policy.
- Ingestion scripts write drafts with the secret key and run only locally, the use AGENTS.md already allows.

### 3. Only the approval function can make a row verified
RLS alone does not keep a script from publishing: the secret key bypasses every policy. Triggers still fire for it, so the rule is a trigger.

- A `BEFORE INSERT OR UPDATE` trigger on each status-bearing table **rejects any write that sets `status = 'verified'` or `verified_at`/`verified_by`**, unless the approval function is running. The function marks that with a transaction-local setting (`set_config(…, true)`) that ends with its transaction.
- **A change to a verified row's facts made outside the function returns it to `draft`.** A fix made in the table editor goes back through review before parents see it again.
- **This stops accidents, not a hostile key holder.** Anyone with the secret key can disable a trigger or set the flag. Such keys stay out of application code and off Vercel (ADR-0010).

### 4. Every change is recorded
A trigger writes each insert, update and delete on the catalog and calendar tables to a `catalog_history` table: the table, the row id, who, when, and the old and new row. This replaces the PR diff as the record of what changed and who approved it.

### 5. Facts the app computes with are columns; everything else is `details`
The test is **does the app filter, sort, compare or constrain on it?**

| Columns | `details` (`jsonb`) |
|---|---|
| Dates, core hours, before- and after-care hours | Field trips, including grade-banded ones |
| Price, ages, grades, category | Activities (swimming, inflatables) |
| Location and point, registration | Policies (switching weeks, refunds, fees) |
| Status and provenance | Other per-camp facts, such as lunch provided |

- `camps.details` and `sessions.details` are `jsonb`, validated on every write against a JSON schema by the **`pg_jsonschema`** extension. Its keys are an agreed vocabulary, not free form.
- The app reads `details` through **one typed parser**. The generated types say only `Json`, so nothing else touches raw keys.
- **A key is promoted to a column when the app needs to compute with it**, for example a "has swimming" filter. That is an ordinary migration.
- `details` holds **facts, never prose** (ADR-0010). A field trip is a destination and a grade band, not the camp's description of it.

## Consequences
- **+** One place for the data, and a reviewer checks a draft on the same screens and through the same queries a parent will use.
- **+** "Automated extraction never publishes directly" (AGENTS.md → Data provenance) is enforced in the database. RLS keeps drafts from parents, and the trigger means nothing becomes verified except through the approval function. The remaining trust is in whoever holds the secret key, as it already is.
- **+** Camp-specific facts need no migration and no ADR, so the schema can be settled now without predicting every attribute.
- **−** **Data changes no longer go through a PR.** The history table records them, but nobody approves a change before it is written. The status gate is what keeps unreviewed data away from parents, so its RLS tests are release-blocking in the same way as the household ones.
- **−** The catalog's RLS stops being trivial. Until now it was `using (true)`, kept simple so the household policies stayed the only ones worth reviewing. It now needs negative-case tests: `anon` sees no drafts, a non-reviewer sees no drafts, a non-reviewer cannot approve, and an ordinary secret-key write of `status = 'verified'` (trigger enabled, flag not set) is refused. The test proves the guard against mistakes; it cannot prove anything about a key holder who turns the guard off.
- **−** `jsonb` is harder to edit in the Supabase table editor and weaker at the type boundary. The schema check and the single parser are the mitigation, and an in-app reviewer view (CAM-3) replaces the table editor as the verification tool.
- **−** The school-calendar parser skill (CAM-23) is described as producing a draft file reviewed by diff. Under this ADR it writes draft rows. The human review step is unchanged; where it happens moves.
- **−** CAM-4, CAM-27 and CAM-28 described the file → seed → switch path and are rewritten to this one.
