# 3. Application framework: Next.js App Router on Vercel

- Status: Accepted
- Date: 2026-09-14

## Context
Search-engine discovery is not what brings the first users here, so the case for server rendering had to be made on other grounds. A Vite SPA was the serious alternative and the faster start.

Three arguments decided it.

**Where secrets live.** Supabase is designed to be called from the browser with the anon key, and RLS makes that safe *when the policies are right*. But "safe when the policies are right" is a thinner margin than we want as the only line of defence on a privacy-sensitive app. Server components let us do sensitive reads server-side, so the policy is a second layer rather than the only one.

**Server-side work needs a home.** Catalog import, admin actions, and anything else that must run with credentials the browser cannot hold need somewhere to live. Route handlers put them inside the same deployment, with no second service to operate.

**The SEO door.** Indexable camp pages are not needed now. If they are ever wanted, Next.js makes that a metadata change rather than a rewrite of the application shell — which is worth a small cost today against a large one later.

## Decision
**Next.js (App Router) with TypeScript, deployed on Vercel.**

- Server Components for catalog reads; Client Components for the planner grid and the map, which are interactive by nature.
- Route handlers for admin and server-credentialed actions.
- **Server-side Supabase access uses the anon key plus the user's JWT, so RLS still applies.** The service-role key never appears in a request-serving runtime (AGENTS.md §1).
- Vercel for hosting: preview deployments per PR, which matters because the humans reviewing camp data are not the humans writing code.

## Consequences
- **+** Sensitive reads happen server-side, with RLS as defence in depth rather than sole defence.
- **+** Preview deploys per PR give a non-technical reviewer a URL.
- **+** SEO is a later metadata pass, not a migration.
- **−** Server/client component boundaries are a real source of confusion, and agents get them wrong. Mitigated by `docs/ABSTRACTIONS.md` documenting the boundary rules explicitly.
- **−** Vercel-shaped deployment. Acceptable at this scale; Next.js runs elsewhere if that changes.
