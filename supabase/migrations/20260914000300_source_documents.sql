-- The camp-sources bucket (ADR-0012).
--
-- Holds what a camp actually said: a saved PDF, a photo of a paper flyer, a
-- screenshot of a Facebook post. A catalog row points at one of these through
-- source_document_path whenever its facts did not come from a durable URL.
--
-- PRIVATE, and deliberately policy-free. No policy on storage.objects means no
-- role but service_role can read or write these files. Two reasons:
--
--   1. They are evidence, not content. If a parent ever needs to see one, the
--      server mints a short-lived signed URL — it does not hand out the bucket.
--   2. A flyer photographed in the wild can contain a staff member's mobile
--      number or a director's home address. That is exactly the kind of thing
--      that should not become world-readable because a bucket was left public.
--
-- ⛔ Do not make this bucket public to "make the source link work". Sign the URL.

insert into storage.buckets (id, name, public)
values ('camp-sources', 'camp-sources', false)
on conflict (id) do nothing;
