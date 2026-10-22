import type { SupabaseClient } from '@supabase/supabase-js';
import { approvedChanges, type Difference, differences } from './differences';
import { type HeldCatalog, type MatchProposal, proposeMatches } from './matches';
import {
  campRow,
  type Existing,
  evidenceColumns,
  IntakeKind,
  type IntakePlan,
  isExisting,
  isNew,
  locationRow,
  type New,
  optionRows,
  type PlannedSession,
  type PlannedUpdate,
  providerRow,
  type SourceDocument,
  sessionRow,
} from './plan';
import type { Drafted, IntakeResult, Updated } from './report';

/**
 * The intake writer (CAM-47): a confirmed plan in, draft rows out. It takes a
 * client rather than making one, so the secret key stays in the local script
 * that runs it (ADR-0017 §2) and never in anything the app imports. The key
 * can write drafts and nothing more: the guard trigger refuses any write that
 * would verify a row.
 *
 * There is no validator here. The database's constraints are the gate, and the
 * first row it refuses stops the run with its words (`IntakeRefusedError`).
 */

export interface WriteOptions {
  /** Stores a document in `camp-sources` under `path`. The real one lives in the script. */
  readonly uploadDocument: (path: string, bytes: Uint8Array) => Promise<void>;
  readonly log?: (line: string) => void;
}

/** The database refused a row. Everything written before it stays, as drafts. */
export class IntakeRefusedError extends Error {
  override name = 'IntakeRefusedError';
  constructor(
    message: string,
    readonly result: IntakeResult,
  ) {
    super(message);
  }
}

/** The owner has not answered a proposed match, so nothing is written. */
export class UnansweredMatchError extends Error {
  override name = 'UnansweredMatchError';
  constructor(readonly proposals: readonly MatchProposal[]) {
    super(`${proposals.length} proposed match(es) are unanswered; confirm or rule out each first`);
  }
}

/** A verified record an update would put back to draft, and how many plan entries that hides. */
export interface UnpublishWarning {
  readonly kind: IntakeKind;
  readonly id: string;
  readonly plannedEntries: number;
}

export interface IntakePreview {
  readonly matches: readonly MatchProposal[];
  readonly differences: readonly {
    readonly update: PlannedUpdate;
    readonly differences: readonly Difference[];
  }[];
  readonly unpublishes: readonly UnpublishWarning[];
}

type CatalogTable = 'providers' | 'camps' | 'locations' | 'sessions' | 'session_options';

const TABLES: ReadonlyMap<string, CatalogTable> = new Map(
  Object.entries({
    [IntakeKind.Provider]: 'providers',
    [IntakeKind.Camp]: 'camps',
    [IntakeKind.Location]: 'locations',
    [IntakeKind.Session]: 'sessions',
    [IntakeKind.Option]: 'session_options',
  } satisfies Record<IntakeKind, CatalogTable>),
);

function tableOf(kind: IntakeKind): CatalogTable {
  const table = TABLES.get(kind);
  if (table === undefined) throw new Error(`No table for intake kind ${kind}`);
  return table;
}

/** The database said no. Caught at the top of a run and reported as its refusal. */
class DatabaseRefusal extends Error {}

type Row = Readonly<Record<string, unknown>>;

async function readRow(client: SupabaseClient, kind: IntakeKind, id: string): Promise<Row> {
  const { data, error } = await client.from(tableOf(kind)).select('*').eq('id', id).single();
  if (error) throw new DatabaseRefusal(`Could not read ${kind} ${id}: ${error.message}`);
  return data as Row;
}

async function idsWhere(
  client: SupabaseClient,
  table: CatalogTable,
  column: string,
  values: readonly string[],
): Promise<string[]> {
  const { data, error } = await client.from(table).select('id').in(column, values);
  if (error) throw new DatabaseRefusal(`Could not read ${table}: ${error.message}`);
  return (data as { id: string }[]).map((row) => row.id);
}

/**
 * Every row of a table, a response at a time. PostgREST caps one response
 * (1000 rows by default), and a match proposal that silently stopped there
 * would miss the duplicate the checkpoint exists to catch.
 */
async function readAll<T>(
  client: SupabaseClient,
  table: CatalogTable,
  columns: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order('id')
      .range(rows.length, rows.length + 999);
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    if (data.length === 0) return rows;
    rows.push(...(data as T[]));
  }
}

async function readHeldCatalog(client: SupabaseClient): Promise<HeldCatalog> {
  const [providers, camps, locations] = await Promise.all([
    readAll<HeldCatalog['providers'][number]>(client, 'providers', 'id, name, status'),
    readAll<HeldCatalog['camps'][number]>(client, 'camps', 'id, name, provider_id, status'),
    readAll<HeldCatalog['locations'][number]>(
      client,
      'locations',
      'id, label, street, postal_code, address_key, status',
    ),
  ]);
  return { providers, camps, locations };
}

/** The record an update would unpublish: the row itself, or an option's session. */
interface Target {
  readonly kind: IntakeKind;
  readonly id: string;
  readonly status: unknown;
}

async function targetOf(client: SupabaseClient, update: PlannedUpdate, held: Row): Promise<Target> {
  if (update.kind !== IntakeKind.Option) return { ...update, status: held.status };
  const id = String(held.session_id);
  const session = await readRow(client, IntakeKind.Session, id);
  return { kind: IntakeKind.Session, id, status: session.status };
}

/** The sessions a record's return to draft would hide from parents. */
async function sessionsUnder(client: SupabaseClient, target: Target): Promise<string[]> {
  switch (target.kind) {
    case IntakeKind.Provider: {
      const camps = await idsWhere(client, 'camps', 'provider_id', [target.id]);
      return idsWhere(client, 'sessions', 'camp_id', camps);
    }
    case IntakeKind.Camp:
      return idsWhere(client, 'sessions', 'camp_id', [target.id]);
    case IntakeKind.Location:
      return idsWhere(client, 'sessions', 'location_id', [target.id]);
    default:
      return [target.id];
  }
}

async function plannedEntries(client: SupabaseClient, target: Target): Promise<number> {
  const sessions = await sessionsUnder(client, target);
  const { count, error } = await client
    .from('plan_entries')
    .select('id', { count: 'exact', head: true })
    .in('session_id', sessions);
  if (error) throw new Error(`Could not count plan entries: ${error.message}`);
  return count ?? 0;
}

/** Everything the checkpoint shows, read-only: it writes nothing. */
export async function previewIntake(
  client: SupabaseClient,
  plan: IntakePlan,
): Promise<IntakePreview> {
  const matches = proposeMatches(plan, await readHeldCatalog(client));
  const shown: IntakePreview['differences'][number][] = [];
  const unpublishes: UnpublishWarning[] = [];
  for (const update of plan.updates) {
    const held = await readRow(client, update.kind, update.id);
    shown.push({ update, differences: differences(held, update) });
    const target = await targetOf(client, update, held);
    const writes = Object.keys(approvedChanges(held, update)).length > 0;
    if (writes && target.status === 'verified')
      unpublishes.push({
        kind: target.kind,
        id: target.id,
        plannedEntries: await plannedEntries(client, target),
      });
  }
  return { matches, differences: shown, unpublishes };
}

/** One run's writes, in order, and the ids of what it drafted or matched, by kind and ref. */
class IntakeRun {
  readonly drafted: Drafted[] = [];
  readonly updated: Updated[] = [];
  private readonly ids = new Map<string, string>();

  constructor(
    readonly client: SupabaseClient,
    private readonly log: (line: string) => void,
  ) {}

  remember(kind: IntakeKind, ref: string, id: string): void {
    this.ids.set(`${kind}:${ref}`, id);
  }

  /** Refuse rather than guess: a ref the plan never drafted or matched is a bug in the plan. */
  idOf(kind: IntakeKind, ref: string): string {
    const id = this.ids.get(`${kind}:${ref}`);
    if (id === undefined) throw new Error(`The plan has no ${kind} "${ref}"`);
    return id;
  }

  async insert(kind: IntakeKind, ref: string, name: string, row: object): Promise<string> {
    const { data, error } = await this.client.from(tableOf(kind)).insert(row).select('id').single();
    if (error) throw new DatabaseRefusal(error.message);
    const id = (data as { id: string }).id;
    this.remember(kind, ref, id);
    this.drafted.push({ kind, id, name });
    this.log(`drafted ${kind} ${name}`);
    return id;
  }

  async update(kind: IntakeKind, id: string, changes: object): Promise<void> {
    const { error } = await this.client.from(tableOf(kind)).update(changes).eq('id', id);
    if (error) throw new DatabaseRefusal(error.message);
  }

  result(refusal?: string): IntakeResult {
    return {
      drafted: this.drafted,
      updated: this.updated,
      ...(refusal === undefined ? {} : { refusal }),
    };
  }
}

/** A matched record's id, or a new one's once inserted. */
async function place<T extends Existing | New<unknown>>(
  run: IntakeRun,
  kind: IntakeKind,
  record: T,
  draft: (record: Exclude<T, Existing>) => Promise<void>,
): Promise<void> {
  if (isExisting(record)) run.remember(kind, record.ref, record.existing);
  else if (isNew(record)) await draft(record);
}

async function draftSession(run: IntakeRun, session: PlannedSession): Promise<void> {
  const name = `${session.ref} (${session.facts.start_date})`;
  const row = sessionRow(
    session,
    run.idOf(IntakeKind.Camp, session.campRef),
    run.idOf(IntakeKind.Location, session.locationRef),
  );
  const sessionId = await run.insert(IntakeKind.Session, session.ref, name, row);
  for (const option of optionRows(session, sessionId))
    await run.insert(
      IntakeKind.Option,
      `${session.ref}:${option.kind}`,
      `${name}, ${option.kind}`,
      option,
    );
}

/** Parents first, so each child's parent id is in hand. */
async function draftRecords(run: IntakeRun, plan: IntakePlan): Promise<void> {
  for (const provider of plan.providers)
    await place(run, IntakeKind.Provider, provider, async (p) => {
      await run.insert(IntakeKind.Provider, p.ref, p.facts.name, providerRow(p));
    });
  for (const location of plan.locations)
    await place(run, IntakeKind.Location, location, async (l) => {
      await run.insert(IntakeKind.Location, l.ref, l.facts.label, locationRow(l));
    });
  for (const camp of plan.camps)
    await place(run, IntakeKind.Camp, camp, async (c) => {
      const row = campRow(c, run.idOf(IntakeKind.Provider, c.providerRef));
      await run.insert(IntakeKind.Camp, c.ref, c.facts.name, row);
    });
  for (const session of plan.sessions) await draftSession(run, session);
}

/**
 * A verified row's facts change only through `reviewer_edit()`, which needs a
 * signed-in reviewer, and a secret-key run has none. So a verified record goes
 * back to draft first (a status-only change, which the guard allows), and the
 * owner re-approves it from its card.
 */
async function applyUpdate(run: IntakeRun, update: PlannedUpdate): Promise<void> {
  const held = await readRow(run.client, update.kind, update.id);
  const changes = approvedChanges(held, update);
  const fields = Object.keys(changes);
  if (fields.length === 0) return;
  const target = await targetOf(run.client, update, held);
  const back = target.status === 'verified' ? { kind: target.kind, id: target.id } : undefined;
  if (back) await run.update(back.kind, back.id, { status: 'draft' });
  // Recorded before the correction is written, so a refusal still reports the unpublish.
  const entry = { kind: update.kind, id: update.id, ...(back ? { setBackToDraft: back } : {}) };
  run.updated.push({ ...entry, fields: [] });
  await writeCorrection(run, update, target, changes);
  run.updated.pop();
  run.updated.push({ ...entry, fields });
}

/** The changes, with the update's source as the evidence. An option's evidence is its session's. */
async function writeCorrection(
  run: IntakeRun,
  update: PlannedUpdate,
  target: Target,
  changes: Record<string, unknown>,
): Promise<void> {
  const evidence = evidenceColumns(update.source);
  if (update.kind !== IntakeKind.Option) {
    await run.update(update.kind, update.id, { ...changes, ...evidence });
    return;
  }
  await run.update(update.kind, update.id, changes);
  await run.update(target.kind, target.id, evidence);
}

async function uploadDocuments(
  documents: readonly SourceDocument[],
  { uploadDocument }: WriteOptions,
): Promise<void> {
  for (const document of documents)
    await uploadDocument(
      document.path,
      Uint8Array.from(atob(document.base64), (char) => char.charCodeAt(0)),
    );
}

/** Writes the plan's drafts and approved corrections, or nothing while a match is unanswered. */
export async function writeIntake(
  client: SupabaseClient,
  plan: IntakePlan,
  options: WriteOptions,
): Promise<IntakeResult> {
  const unanswered = proposeMatches(plan, await readHeldCatalog(client));
  if (unanswered.length > 0) throw new UnansweredMatchError(unanswered);
  await uploadDocuments(plan.documents ?? [], options);

  const run = new IntakeRun(client, options.log ?? (() => {}));
  try {
    await draftRecords(run, plan);
    for (const update of plan.updates) await applyUpdate(run, update);
  } catch (error) {
    if (error instanceof DatabaseRefusal)
      throw new IntakeRefusedError(error.message, run.result(error.message));
    throw error;
  }
  return run.result();
}
