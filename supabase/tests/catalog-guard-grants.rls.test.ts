import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { optionRow, withSeededSession } from './catalog-fixtures';
import { isLiveProject, runSql } from './helpers';

/**
 * The guard triggers call two internal functions as the writing role
 * (CAM-28). Their migration revoked them from `public, anon, authenticated`
 * and left `service_role` to platform default privileges, which local Docker
 * keeps and the hosted project does not: the first live import died on
 * "permission denied for function refuse_if_session_verified".
 *
 * So this test removes those defaults, as hosted does, and applies the fix
 * migration. Local only: it revokes grants.
 */

const MIGRATION = 'supabase/migrations/20261009000100_guard_function_grants.sql';
const GUARDS = ['refuse_if_session_verified(uuid)', 'refuse_if_calendar_verified(uuid)'];

function applyMigration(): void {
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_campout',
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: readFileSync(MIGRATION), stdio: ['pipe', 'ignore', 'pipe'] },
  );
}

describe.skipIf(isLiveProject())('guard function grants', () => {
  afterAll(() => {
    // Leave the local database as the migrations make it.
    applyMigration();
  });

  it('lets the secret key write an option once hosted default privileges are gone', async () => {
    for (const guard of GUARDS) runSql(`revoke execute on function ${guard} from service_role`);

    await withSeededSession(async ({ sessionId }, admin) => {
      const before = await admin.from('session_options').insert(optionRow(sessionId));
      expect(before.error?.code).toBe('42501');

      applyMigration();

      const after = await admin.from('session_options').insert(optionRow(sessionId));
      expect(after.error).toBeNull();
    });
  });

  it.each(GUARDS)('grants service_role execute on %s', (guard) => {
    expect(runSql(`select has_function_privilege('service_role', '${guard}', 'execute')`)).toMatch(
      /\bt\b/,
    );
  });
});
