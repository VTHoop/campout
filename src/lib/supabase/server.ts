import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from './env';

/**
 * The Supabase client for Server Components and route handlers (ADR-0003):
 * the publishable key plus the user's JWT from their cookies, so RLS still
 * applies. Never the secret key.
 *
 * A Server Component cannot set cookies, so a write there throws and is
 * ignored; `src/proxy.ts` refreshes the session on every request instead.
 */
export async function createClient() {
  const { url, publishableKey } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component; the proxy keeps the session fresh.
        }
      },
    },
  });
}
