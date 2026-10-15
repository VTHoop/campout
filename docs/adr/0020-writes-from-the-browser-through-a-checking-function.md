# 20. A signed-in user's own write may go from the browser, through a function that checks the caller

- Status: Accepted
- Date: 2026-10-15
- Supersedes: [ADR-0003](./0003-application-framework-nextjs-vercel.md)'s line *"Route handlers for admin and server-credentialed actions"*, as far as it could be read to mean that every database write runs on the server. Server Components for catalog reads, the anon key plus the user's JWT, and the rule that the service-role key never reaches a request-serving runtime all stand.

## Context
CAM-46 lets a reviewer approve a draft record from its card. The card is a Client Component (it holds focus, a confirm dialog and the in-place update of every card that shares a record), and it calls `approve_record()` with the browser's Supabase client, as the signed-in user. It is the first write the browser makes.

ADR-0003 reasoned that RLS alone is a thin line of defence for a privacy-sensitive app, so sensitive reads happen on the server and the policy is a second layer. A write from the browser has no server layer in front of it, so the question needs an answer instead of an accident.

What stands in front of this write is the function, not the policy. `approve_record()` is `SECURITY DEFINER`, reads `reviewers` for `auth.uid()` and refuses anyone who is not listed before it touches a row. The guard triggers refuse any other way of setting `verified`, even for the secret key (ADR-0017). A browser that calls the function can do exactly what the function allows the caller to do, and nothing a hand-built request to the table could.

## Decision
- **A write that belongs to the signed-in user may be made from the browser, with the publishable key and the user's own session, when it goes through a `SECURITY DEFINER` function that checks the caller itself.** `approve_record()` is the first. The household creation function (ADR-0011) is the same shape.
- **A browser never writes a table directly for catalog or household data.** The function is the only door; the table's policies and triggers stay closed to a direct write.
- **A new write from the browser needs its own function with RLS-style negative tests in the same PR** (a caller who should be refused, and is). It is not covered by this decision just because it is a function.
- **Anything that needs credentials the browser cannot hold** (importing a catalog, an admin action with the secret key) stays in a route handler or a server-only script, as ADR-0003 says.

## Alternatives considered
- **A Server Action (or route handler) that calls the function on the user's behalf.** Keeps the rule "the browser never writes" literally true. It adds a server hop and a mock boundary to every approval, and the function already does the check a server layer would repeat. Rejected as more parts for no extra guard; revisit if a write ever needs something the function cannot check.
- **A permissive policy on the tables, with the browser writing rows.** Rejected: it is the "policy is the only line of defence" shape ADR-0003 warned against, and ADR-0011 showed policies cannot express the ordering these writes need.

## Consequences
- **+** One fewer layer for the first reviewer action, and the card updates without a page transition.
- **+** The rule is stated: a browser write is a function that checks its caller, with a negative test.
- **−** Browser code can reach the database for writes, so the next one has this precedent. The three conditions above are what keep it honest.
- **−** `docs/ABSTRACTIONS.md`'s "Server vs. Client Components" rule gains this exception, and has to be kept in step.
