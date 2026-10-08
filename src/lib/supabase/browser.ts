import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from './env';

/** The Supabase client for Client Components: publishable key, the user's own session. */
export function createClient() {
  const { url, publishableKey } = supabaseEnv();
  return createBrowserClient(url, publishableKey);
}
