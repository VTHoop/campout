import { NextResponse } from 'next/server';
import { safeNextPath } from '@/lib/auth/safe-next';
import { siteUrl } from '@/lib/auth/site-url';
import { createClient } from '@/lib/supabase/server';

/**
 * Finishes a magic-link sign-in (CAM-41): swaps the link's one-time code for a
 * session cookie, then returns the user to the page they came from.
 *
 * Anything that stops that from happening, whether the code is missing,
 * expired, already used or invalid, sends the user to /sign-in with the same
 * message and leaves them signed out.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (code && !searchParams.has('error')) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(siteUrl(safeNextPath(searchParams.get('next')), request));
    }
  }

  return NextResponse.redirect(siteUrl('/sign-in?error=link', request));
}
