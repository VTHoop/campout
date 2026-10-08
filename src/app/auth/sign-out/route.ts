import { NextResponse } from 'next/server';
import { siteUrl } from '@/lib/auth/site-url';
import { createClient } from '@/lib/supabase/server';

/**
 * Signs the user out and sends them home (CAM-41). POST only, so a link or an
 * image tag on another site cannot sign anyone out; 303 so the browser follows
 * the redirect with a GET.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(siteUrl('/', request), 303);
}
