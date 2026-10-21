// Camp intake (CAM-47): the local half of the camp-intake skill.
// Run from the workspace root:
//   pnpm camp:intake held <provider name>   print what we hold for a provider, as JSON
//   pnpm camp:intake <plan.json>            the checkpoint: matches, differences, warnings; writes nothing
//   pnpm camp:intake <plan.json> --yes      write the drafts and approved corrections, then report
//
// Local only, with the secret key (ADR-0017 §2, ADR-0020): never in app code, never
// on Vercel. The key writes drafts and nothing more: the guard trigger refuses any
// row it would verify. Plans live in scratch/intake/, which git ignores (ADR-0017 §1:
// the database is the only copy of the data).
import { readFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { IntakePlan } from '../src/lib/catalog/intake/plan';
import { formatReport } from '../src/lib/catalog/intake/report';
import {
  type IntakePreview,
  IntakeRefusedError,
  previewIntake,
  UnansweredMatchError,
  writeIntake,
} from '../src/lib/catalog/intake/write';

const DOCUMENT_BUCKET = 'camp-sources';

const CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  ['pdf', 'application/pdf'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['html', 'text/html'],
]);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set. Put it in .env.local (see .env.example).`);
    process.exit(2);
  }
  return value;
}

function secretClient(): SupabaseClient {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  console.log(`Project: ${new URL(url).host}`);
  return createClient(url, required('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A provider we hold, with its camps, their sessions and options, and the sessions' locations. */
async function printHeld(client: SupabaseClient, name: string): Promise<void> {
  const { data, error } = await client
    .from('providers')
    .select('*, camps(*, sessions(*, session_options(*)))')
    .ilike('name', `%${name}%`);
  if (error) throw new Error(`Could not read providers: ${error.message}`);
  const held = data as { camps: { sessions: { location_id: string }[] }[] }[];
  const locationIds = [
    ...new Set(held.flatMap((p) => p.camps.flatMap((c) => c.sessions.map((s) => s.location_id)))),
  ];
  const locations = await client.from('locations').select('*').in('id', locationIds);
  if (locations.error) throw new Error(`Could not read locations: ${locations.error.message}`);
  console.log(JSON.stringify({ providers: data, locations: locations.data }, null, 2));
}

function printPreview(preview: IntakePreview, plan: IntakePlan): void {
  console.log(`\nMatches to confirm (${preview.matches.length}):`);
  for (const match of preview.matches) {
    console.log(`  ${match.kind} "${match.name}" (ref ${match.ref}) may be:`);
    for (const c of match.candidates) console.log(`    ${c.id}  ${c.name}  [${c.status}]`);
  }
  console.log(`\nDifferences (${preview.differences.flatMap((d) => d.differences).length}):`);
  for (const { update, differences } of preview.differences)
    for (const d of differences) {
      const answer = update.approved.includes(d.field) ? 'approved' : 'not approved';
      console.log(
        `  ${update.kind} ${update.id} · ${d.field} · ours ${JSON.stringify(d.ours)} · source ${JSON.stringify(d.source)} · ${d.sourceUrl}  [${answer}]`,
      );
    }
  console.log(`\nPut back to draft (${preview.unpublishes.length}):`);
  for (const u of preview.unpublishes)
    console.log(
      `  ${u.kind} ${u.id}: hides ${u.plannedEntries} plan entr(y/ies) until re-approved`,
    );
  const options = plan.sessions.reduce((sum, session) => sum + session.options.length, 0);
  console.log(
    `\nWould draft: ${plan.providers.length} provider(s), ${plan.locations.length} location(s), ` +
      `${plan.camps.length} camp(s), ${plan.sessions.length} session(s), ${options} option(s), ` +
      'less any matched to a record we hold.',
  );
}

async function upload(client: SupabaseClient, path: string, bytes: Uint8Array): Promise<void> {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  const { error } = await client.storage.from(DOCUMENT_BUCKET).upload(path, bytes, {
    contentType: CONTENT_TYPES.get(extension) ?? 'application/octet-stream',
    // A re-run after a refusal finds the file already there.
    upsert: true,
  });
  if (error) throw new Error(`Could not upload ${path}: ${error.message}`);
}

async function runPlan(client: SupabaseClient, planPath: string, write: boolean): Promise<void> {
  const plan = JSON.parse(await readFile(planPath, 'utf8')) as IntakePlan;
  printPreview(await previewIntake(client, plan), plan);
  if (!write) {
    console.log('\nCheckpoint: nothing written. Re-run with --yes once the owner has confirmed.');
    return;
  }
  try {
    const result = await writeIntake(client, plan, {
      readDocument: async (file) => new Uint8Array(await readFile(file)),
      uploadDocument: (path, bytes) => upload(client, path, bytes),
      log: (line) => console.log(`  ${line}`),
    });
    console.log(`\n${formatReport(plan, result)}`);
  } catch (error) {
    if (error instanceof IntakeRefusedError) {
      console.log(`\n${formatReport(plan, error.result)}`);
      process.exit(1);
    }
    if (error instanceof UnansweredMatchError) {
      console.error(`\n${error.message}. Nothing was written.`);
      process.exit(1);
    }
    throw error;
  }
}

const [command, ...rest] = process.argv.slice(2);
if (!command) {
  console.error('Usage: pnpm camp:intake held <provider name> | <plan.json> [--yes]');
  process.exit(2);
}
const client = secretClient();
if (command === 'held') await printHeld(client, rest.join(' '));
else await runPlan(client, command, rest.includes('--yes'));
