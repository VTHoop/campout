-- The guard triggers on session_options and school_closures run as the role
-- that writes (they are not SECURITY DEFINER) and call these two functions.
-- 20260930000100 revoked both from public, anon and authenticated and left
-- service_role to the platform's default privileges. Local Docker keeps those
-- defaults; the hosted project does not, so the first live import failed with
-- "permission denied for function refuse_if_session_verified" (CAM-28).
--
-- Granted explicitly, so no environment's defaults decide it. Still not
-- granted to anon or authenticated: they have no write path to these tables,
-- and a refused write should stay a policy refusal rather than a function one.
grant execute on function refuse_if_session_verified(uuid), refuse_if_calendar_verified(uuid)
  to service_role;
