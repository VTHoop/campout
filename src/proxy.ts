import type { NextRequest } from 'next/server';
import { refreshSession } from '@/lib/supabase/session';

/** Keeps the Supabase session alive on every page request (CAM-41). */
export function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  // Pages only: not Next's static output or image files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
