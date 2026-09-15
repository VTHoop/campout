# 12. Provenance may be a URL or a stored document, never neither

- Status: Accepted
- Date: 2026-09-15

## Context
The original catalog schema made three columns `NOT NULL` on every camp: `website_url`, `source_url`, and (on sessions) `registration_url`. That conflated three different things under one idea, and the mistake only became visible when someone asked what happens to a camp with no website.

They are not the same:

- **`website_url`** is the camp's own site. A parish, a rec league, or a neighbour running a soccer week may have none.
- **`registration_url`** is where a parent signs up. Paper forms, phone calls, and walk-in registration are all normal in this market.
- **`source_url`** is where *we* got the facts. This is the liability column — it is what makes "we checked this against something real" data rather than a claim.

Requiring all three excluded exactly the camps Campout exists to surface. The project brief describes information "scattered across hundreds of individual websites, PDFs, and Facebook posts", and the schema accepted only the first of those three.

But loosening `source_url` to nullable would have quietly turned provenance into "trust me", which is the thing the column exists to prevent.

## Decision
**`website_url` and `registration_url` become nullable.** A session adds `registration_note` for the instructions when there is no link, and a check constraint requires one or the other — a parent must always be told how to sign up.

**Provenance stays mandatory but stops assuming a web page.** Every camp, session, and school calendar carries:

- `source_url` — nullable
- `source_document_path` — nullable, a file in the private `camp-sources` bucket
- `verified_at`, `verified_by` — still `NOT NULL`, always

…with a check constraint requiring **at least one of the two evidence columns**. A record with neither cannot be inserted.

**A written note is deliberately not sufficient evidence.** When the facts come from a phone call or a paper flyer, the verifier saves something — a photo of the flyer, a screenshot of the Facebook post, a PDF — and the record points at it. The alternative considered was a free-text `source_note` ("phoned the director on the 3rd"), rejected because a note is an assertion about evidence rather than the evidence itself. If a camp ever disputes what we published, a note proves nothing.

**The `camp-sources` bucket is private and carries no storage policies**, so only the service role can read or write it. A parent who needs to see a source gets a short-lived signed URL minted server-side. Two reasons it is not public: these are evidence rather than content, and a flyer photographed in the wild can carry a staff member's mobile number or a director's home address.

## Consequences
- **+** A camp whose only presence is a paper flyer on a parish noticeboard is listable — and those are disproportionately the small, cheap, neighbourhood camps no existing directory carries.
- **+** Provenance got *stronger*, not weaker. Before, a `source_url` could point at a page that changed the next day and nothing preserved what it said. A stored artifact does.
- **+** The rule is a check constraint, so it holds against the table editor, a script, and any code written later.
- **−** More work per record when there is no URL: the verifier has to capture and upload something. Accepted — that is the cost of being able to list the camp at all.
- **−** Storage costs money eventually, and the bucket grows by one artifact per offline source per year. Negligible at this scale, worth watching if the catalog grows into the thousands.
- **−** Signed-URL generation is now on the path for any UI that shows a source document. Not yet built; noted so it is not a surprise.
