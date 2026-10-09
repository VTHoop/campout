import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { supabaseEnv } from './env';

/**
 * Refreshes the signed-in user's session on a request, so it outlasts the
 * access token's short life across reloads and new tabs. `getClaims()` is what
 * triggers the refresh. It also verifies the token's signature rather than
 * trusting the cookie, and does so locally when the project signs with
 * asymmetric keys, so this is not a round trip to Supabase on every page.
 *
 * The refreshed cookies go on both the request (so this render sees them) and
 * the response (so the browser keeps them).
 */
export async function refreshSession(request: NextRequest): Promise<NextResponse> {
  const { url, publishableKey } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}
