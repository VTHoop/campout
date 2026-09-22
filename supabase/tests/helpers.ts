import { execFileSync } from 'node:child_process';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

/**
 * Harness for the Row Level Security policy suite (ADR-0004).
 *
 * These tests run against a real local Supabase instance, because RLS is
 * enforced by Postgres and nothing else. A mock would test our idea of the
 * policies rather than the policies.
 */

interface LocalKeys {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

let cached: LocalKeys | null = null;

/**
 * Pull one required value out of `supabase status`, naming it if it is absent.
 *
 * One value at a time rather than one combined check: a single condition is
 * easier to read, and the failure says exactly which key is missing instead of
 * listing all three and leaving you to work it out.
 */
function required(value: string | undefined, name: string): string {
  if (value) return value;
  throw new Error(
    `supabase status did not return ${name}. Is the local stack running? Try pnpm supabase:start`,
  );
}

/**
 * Read SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY, so the
 * same suite can be pointed at a live project (CAM-25) instead of only local
 * Docker. All three or none: a half-set override would silently mix a remote
 * URL with local keys, which fails as a confusing auth error rather than
 * pointing at the real mistake.
 */
function envKeys(): LocalKeys | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && anonKey && serviceRoleKey) return { url, anonKey, serviceRoleKey };
  return null;
}

/**
 * Read the stack's URL and keys — from the environment when pointed at a live
 * project, otherwise from the Supabase CLI's local status.
 *
 * Shelling out beats hard-coding the well-known local demo keys: those change
 * between CLI versions, and a stale constant fails as "invalid JWT" rather than
 * as anything that points at the real problem.
 */
export function localKeys(): LocalKeys {
  if (cached) return cached;

  const fromEnv = envKeys();
  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }

  let raw: string;
  try {
    raw = execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (cause) {
    throw new Error(
      'Could not read local Supabase status. Start the stack first:\n' +
        '  pnpm supabase:start\n' +
        'These tests need a real Postgres — RLS cannot be tested without one.',
      { cause },
    );
  }

  const status = JSON.parse(raw) as Record<string, string | undefined>;

  cached = {
    url: required(status.API_URL, 'API_URL'),
    anonKey: required(status.ANON_KEY, 'ANON_KEY'),
    serviceRoleKey: required(status.SERVICE_ROLE_KEY, 'SERVICE_ROLE_KEY'),
  };
  return cached;
}

/**
 * A client holding the service-role key, which **bypasses every RLS policy**.
 *
 * Legitimate here and nowhere else: creating test users needs admin rights, and
 * a few assertions need to see rows a policy is correctly hiding, to prove the
 * row exists and is merely invisible rather than absent. Application code may
 * never do this (AGENTS.md §1) — the privacy guard blocks it in src/ and
 * packages/, and this directory is deliberately outside that gate.
 */
export function serviceClient(): SupabaseClient {
  const { url, serviceRoleKey } = localKeys();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  /** A client authenticated as this user. Every request carries their JWT, so RLS applies. */
  client: SupabaseClient;
}

/**
 * Create a confirmed user and return a client signed in as them.
 *
 * Each call makes a genuinely new user with a unique email, so tests never share
 * an identity and cannot pass because of leftover state from another file.
 */
export async function createTestUser(label: string): Promise<TestUser> {
  const { url, anonKey } = localKeys();
  const admin = serviceClient();

  const email = `${label}-${crypto.randomUUID()}@campout.test`;
  const password = crypto.randomUUID();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Could not create test user ${label}: ${error.message}`);
  const id = data.user?.id;
  if (!id) throw new Error(`Created test user ${label} but got no id back`);

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error)
    throw new Error(`Could not sign in test user ${label}: ${signIn.error.message}`);

  return { id, email, client };
}

/** A client with no session at all — the anonymous visitor reading the public catalog. */
export function anonClient(): SupabaseClient {
  const { url, anonKey } = localKeys();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Create a household owned by `user` and return its id.
 *
 * Goes through the create_household RPC because that is the only path there is —
 * households carry no INSERT policy, so a direct insert is refused for everyone.
 */
export async function createHousehold(user: TestUser, name: string): Promise<string> {
  const { data, error } = await user.client.rpc('create_household', {
    household_name: name,
    household_district: 'chesterfield',
  });

  if (error) throw new Error(`Could not create household "${name}": ${error.message}`);
  const id = (data as { id?: string } | null)?.id;
  if (!id) throw new Error(`create_household returned no id for "${name}"`);
  return id;
}

/** Remove every user this suite created, along with the rows that cascade from them. */
export async function deleteTestUsers(users: readonly TestUser[]): Promise<void> {
  const admin = serviceClient();
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.id);
  }
}
