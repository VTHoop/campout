# 21. Intake corrects a verified record by returning it to draft, with a warning first

- Status: Accepted
- Date: 2026-10-22 (CAM-47; decided in its refinement, 2026-10-20)
- Supersedes: [ADR-0017](./0017-catalog-storage-drafts-in-the-database.md) §3 decision 13, only as far as its reasoning could be read to rule out returning a verified row to draft as a way to correct it. For a correction made by the intake script, that is now the path. The rest of decision 13 stands: a direct change to a verified row's facts is refused, and a signed-in reviewer still corrects one in place through `reviewer_edit()`.

## Context
CAM-47 adds the camp-intake skill. A local script writes its drafts with the secret key (ADR-0017 §2). Sometimes a source disagrees with a record we have already verified, like a renamed program or a changed price, and the run has to correct it.

ADR-0017 decision 13 refuses a direct change to a verified row's facts. Its way to correct one is `reviewer_edit()`, which keeps the row verified. Decision 13 rejected the earlier rule, "a change to a verified row's facts returns it to draft", because returning a row to draft "would instantly hide a session from every family that planned it". It kept the status-only change, for archiving.

The intake script can't call `reviewer_edit()`. That function checks `is_reviewer()`, which reads `auth.uid()` (`20260930000100_catalog_review_gate.sql`). A secret-key run has no signed-in user, so the check fails. Giving the script a reviewer's session, or a second function that trusts the secret key, would widen what the key can do. ADR-0017 §3 keeps that key able to write drafts and nothing more.

## Decision
- **The intake script corrects a verified record in two writes.** First it returns the record to `draft`, a status-only change that the guard trigger already allows. Then it writes the approved changes and the update's evidence to the draft. The owner re-approves the record from its card (CAM-46), and that sets `verified_at` again.
- **A verified session's option is corrected by returning its session to draft first.** The guard refuses option changes while their session is verified.
- **Unpublishing is never silent:**
  - The checkpoint preview (`previewIntake()`) lists every verified record a correction would return to draft, with the number of plan entries that would stop resolving for families. The owner approves with that count in front of them.
  - The run report names each record returned to draft, and what to re-approve. This holds even when the database refuses the correction after the status change (`write.ts › applyUpdate`).
- **Nothing else changes.** Only `approve_record()` can make a row verified; the guard refuses an update to `verified` from the script, and a test proves it. A reviewer working from the app still uses `reviewer_edit()` and never unpublishes.

## Alternatives considered
- **Call `reviewer_edit()` as a reviewer.** That means a reviewer's session in a local script, or a refresh token on disk. It's another credential to guard, for a step the owner can take from the card.
- **A `SECURITY DEFINER` correction function that trusts the secret key.** The key would then be able to change verified facts without anyone re-approving them, and that is the line ADR-0017 §3 draws.
- **Refuse to correct verified records at all, and send the owner to edit them by hand.** The run would then know about the difference and leave it unrecorded, and a hand edit leaves no evidence on the row.

## Consequences
- **+** A correction leaves the record showing the facts and the evidence they came from, and a human looks again before parents see it.
- **+** The script stays a draft-only writer; the trigger and the approval function are unchanged.
- **−** Between the run and the re-approval, the corrected record and everything under it are hidden from parents. A family that planned an affected session sees it as no longer listed, which can break the page until CAM-49 lands. The preview's plan-entry count is the mitigation, and the owner can hold a correction until a quieter time.
- **−** If the database refuses the correction after the status change, the record stays a draft with its old facts until the owner re-approves it or the run is fixed and re-run. The report says which record that is.
