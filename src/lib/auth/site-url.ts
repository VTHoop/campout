/**
 * A URL for `path` on the host the user is actually on.
 *
 * Next reports the origin it was started with (`localhost`), which can differ
 * from the one in the browser (`127.0.0.1`). A session cookie belongs to one
 * host, so a redirect to the other would land the user signed out. The proxy's
 * `x-forwarded-host` wins where there is one. A client can only point this at
 * itself: the redirect goes back to whoever sent the request.
 */
export function siteUrl(path: string, request: Request): URL {
  const origin = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host) origin.host = host;
  return new URL(path, origin);
}
