/**
 * The two public Supabase values, read once and refused loudly when absent.
 *
 * Each is spelled out as `process.env.NEXT_PUBLIC_…` because Next inlines only
 * that literal form into the browser bundle. The publishable key is the only
 * key app code may hold; the secret key never comes through here (AGENTS.md →
 * Row Level Security).
 */
function required(value: string | undefined, name: string): string {
  if (value) return value;
  throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
}

export function supabaseEnv(): { url: string; publishableKey: string } {
  return {
    url: required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: required(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    ),
  };
}
