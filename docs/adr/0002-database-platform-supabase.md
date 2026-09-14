# 2. Database platform: Supabase Postgres

- Status: Accepted
- Date: 2026-09-14

## Context
Campout needs a database that can do four things: hold a normalized camp catalog, answer distance queries, enforce a hard privacy boundary between households, and — critically — let a human verify ~50 camp records by hand without us building an admin app first.

Three options were considered.

**Convex** was the familiarity play — the team had used it before. It was rejected on fit. Geospatial search needs an add-on component rather than a first-class index, and the verification workflow would mean building CRUD screens from scratch. Convex suits a reactive, write-heavy application with secret server-held state; Campout is a read-heavy relational catalog with a geographic query at its center. Different problem.

**Neon** is hosted Postgres and nothing else — correct database, but auth, file storage, and every admin screen become our work.

**Supabase** is hosted Postgres plus the surrounding pieces we would otherwise assemble.

The deciding argument is the time budget. Our scarcest resource is founder hours, and a large share of them goes to **entering and verifying camp records** rather than to writing application code. Supabase's built-in table editor is that tool, free, on day one. On Neon we would spend those hours building internal CRUD that no user will ever see.

## Decision
**Supabase** is the database, auth provider, and file store.

- Postgres 15+ with **PostGIS** enabled for location queries (ADR-0007).
- **Supabase Auth** (magic link) issues the JWT that drives Row Level Security (ADR-0004).
- **Supabase Storage** holds source PDFs captured at verification time.
- Schema changes are **migrations in `supabase/migrations/`**, committed and code-reviewed. The dashboard is for *reading and verifying data*, never for altering schema — a schema change made by hand in the dashboard is invisible to git and will be lost on the next reset.
- The **Supabase table editor is the camp verification tool.** Human verification of every record is a product rule (AGENTS.md §2), and the table editor is how it is done today.

## Consequences
- **+** Auth, storage, geo, and the verification tool arrive together. Fewest moving parts of the three options.
- **+** Plain SQL and plain tables — an agent can reason about the data model without learning a proprietary query layer, and a human can eyeball a row.
- **−** **Row Level Security is a real learning curve and the main risk this decision introduces.** It is easy to get subtly wrong, and this app holds children's first names and ages. Mitigated by making RLS a tested boundary with mandatory negative-case tests (ADR-0004), not a checkbox.
- **−** Local development needs Docker for the Supabase stack. Acceptable on two developer laptops.
