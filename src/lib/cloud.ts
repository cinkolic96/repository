import { useSyncExternalStore } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  applyRemoteDelete,
  applyRemoteSnapshot,
  applyRemoteSettings,
  applyRemoteUpsert,
  cachedAgencyData,
  connectRemote,
  disconnectRemote,
  emptyDB,
  KINDS,
  normalizeDB,
  uid,
  type Kind,
  type Remote,
} from './store';
import type { DB, Settings } from './types';

export type Role = 'owner' | 'staff';

export interface Membership {
  agencyId: string;
  agencyName: string;
  role: Role;
}

export interface Member {
  userId: string;
  email: string | null;
  role: Role;
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
}

function sb() {
  if (!supabase) throw new Error('Server nije podešen');
  return supabase;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ---------- Agencije i tim ----------

export async function acceptInvites(): Promise<number> {
  return check(await sb().rpc('accept_invites')) as number;
}

export async function myMemberships(userId: string): Promise<Membership[]> {
  const rows = check(
    await sb().from('agency_members').select('agency_id, role, agencies(name)').eq('user_id', userId),
  ) as unknown as { agency_id: string; role: Role; agencies: { name: string } | null }[];
  return rows.map((r) => ({ agencyId: r.agency_id, role: r.role, agencyName: r.agencies?.name ?? '' }));
}

export async function createAgency(name: string): Promise<string> {
  return check(await sb().rpc('create_agency', { agency_name: name })) as string;
}

export async function listMembers(agencyId: string): Promise<Member[]> {
  const rows = check(await sb().from('agency_members').select('user_id, email, role').eq('agency_id', agencyId).order('created_at')) as {
    user_id: string;
    email: string | null;
    role: Role;
  }[];
  return rows.map((r) => ({ userId: r.user_id, email: r.email, role: r.role }));
}

export async function setMemberRole(agencyId: string, userId: string, role: Role) {
  check(await sb().from('agency_members').update({ role }).eq('agency_id', agencyId).eq('user_id', userId));
}

export async function removeMember(agencyId: string, userId: string) {
  check(await sb().from('agency_members').delete().eq('agency_id', agencyId).eq('user_id', userId));
}

export async function listInvites(agencyId: string): Promise<Invite[]> {
  return check(await sb().from('agency_invites').select('id, email, role').eq('agency_id', agencyId).order('created_at')) as Invite[];
}

export async function createInvite(agencyId: string, email: string, role: Role) {
  check(await sb().from('agency_invites').insert({ agency_id: agencyId, email: email.trim().toLowerCase(), role }));
}

export async function deleteInvite(id: string) {
  check(await sb().from('agency_invites').delete().eq('id', id));
}

// ---------- Učitavanje podataka ----------

const PAGE = 1000;

async function fetchAll(agencyId: string): Promise<DB> {
  const agency = check(await sb().from('agencies').select('name, settings').eq('id', agencyId).single()) as {
    name: string;
    settings: Partial<Settings>;
  };
  const db: DB = { ...emptyDB(), settings: { ...emptyDB().settings, agencyName: agency.name, ...agency.settings } };
  for (let from = 0; ; from += PAGE) {
    const rows = check(
      await sb().from('records').select('id, kind, data').eq('agency_id', agencyId).order('id').range(from, from + PAGE - 1),
    ) as { id: string; kind: Kind; data: never }[];
    for (const r of rows) (db[r.kind] as unknown[]).push(r.data);
    if (rows.length < PAGE) break;
  }
  return normalizeDB(db);
}

// ---------- Red čekanja za slanje promjena ----------

type Op =
  | { t: 'upsert'; kind: Kind; items: { id: string }[] }
  | { t: 'delete'; ids: string[] }
  | { t: 'settings'; settings: Settings };

export interface SyncStatus {
  state: 'idle' | 'saving' | 'error' | 'offline';
  pending: number;
  error?: string;
}

let status: SyncStatus = { state: 'idle', pending: 0 };
const statusListeners = new Set<() => void>();
function setStatus(s: SyncStatus) {
  status = s;
  statusListeners.forEach((l) => l());
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => status,
  );
}

let queue: Op[] = [];
let queueKey = '';
let agency = '';
let running = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
/** id-jevi koji čekaju slanje – realtime eho za njih se ignoriše */
const pendingIds = new Map<string, number>();

function saveQueue() {
  try {
    localStorage.setItem(queueKey, JSON.stringify(queue));
  } catch {
    /* ignoriši */
  }
}

function idsOf(op: Op): string[] {
  return op.t === 'upsert' ? op.items.map((x) => x.id) : op.t === 'delete' ? op.ids : [];
}

function enqueue(op: Op) {
  queue.push(op);
  for (const id of idsOf(op)) pendingIds.set(id, (pendingIds.get(id) ?? 0) + 1);
  saveQueue();
  void runQueue();
}

const CHUNK = 500;

async function send(op: Op) {
  const db = sb();
  if (op.t === 'upsert') {
    for (let i = 0; i < op.items.length; i += CHUNK) {
      const rows = op.items.slice(i, i + CHUNK).map((data) => ({ id: data.id, agency_id: agency, kind: op.kind, data }));
      check(await db.from('records').upsert(rows));
    }
  } else if (op.t === 'delete') {
    for (let i = 0; i < op.ids.length; i += CHUNK) {
      check(await db.from('records').delete().in('id', op.ids.slice(i, i + CHUNK)));
    }
  } else {
    check(await db.from('agencies').update({ settings: op.settings, name: op.settings.agencyName }).eq('id', agency));
  }
}

async function runQueue() {
  if (running || !agency) return;
  running = true;
  clearTimeout(retryTimer);
  while (queue.length) {
    setStatus({ state: 'saving', pending: queue.length });
    const op = queue[0];
    try {
      await send(op);
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setStatus({ state: offline ? 'offline' : 'error', pending: queue.length, error: (e as Error).message });
      running = false;
      retryTimer = setTimeout(() => void runQueue(), 8000);
      return;
    }
    queue.shift();
    for (const id of idsOf(op)) {
      const n = (pendingIds.get(id) ?? 1) - 1;
      if (n <= 0) pendingIds.delete(id);
      else pendingIds.set(id, n);
    }
    saveQueue();
  }
  setStatus({ state: 'idle', pending: 0 });
  running = false;
}

export function retrySync() {
  void runQueue();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void runQueue().then(() => resync());
  });
}

const remoteAdapter: Remote = {
  upsert: (kind, items) => enqueue({ t: 'upsert', kind, items }),
  remove: (ids) => enqueue({ t: 'delete', ids }),
  saveSettings: (settings) => enqueue({ t: 'settings', settings }),
};

// ---------- Povezivanje ----------

let channel: RealtimeChannel | null = null;
let resyncing = false;

/**
 * Ponovo učitava sve sa servera i zamjenjuje lokalno stanje. Poziva se kad se
 * realtime veza (ponovo) uspostavi ili se aplikacija vrati u fokus, da se
 * ne propuste promjene nastale dok veza nije radila.
 */
async function resync() {
  const id = agency;
  if (!id || resyncing || queue.length) return;
  resyncing = true;
  try {
    const db = await fetchAll(id);
    if (id === agency && !queue.length) applyRemoteSnapshot(db);
  } catch {
    /* bez interneta – pokušaće se ponovo */
  } finally {
    resyncing = false;
  }
}

let hiddenAt = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (Date.now() - hiddenAt > 30_000) void resync();
  });
}

/**
 * Učitava podatke agencije i uključuje sinhronizaciju. Ako server nije
 * dostupan, koristi posljednje podatke sačuvane na uređaju.
 */
export async function openAgency(agencyId: string): Promise<{ offline: boolean }> {
  await closeAgency();
  agency = agencyId;
  queueKey = `rentacar-queue-${agencyId}`;
  try {
    queue = JSON.parse(localStorage.getItem(queueKey) ?? '[]');
  } catch {
    queue = [];
  }
  pendingIds.clear();
  queue.forEach((op) => idsOf(op).forEach((id) => pendingIds.set(id, (pendingIds.get(id) ?? 0) + 1)));

  let db: DB;
  let offline = false;
  try {
    // Prvo pošalji neposlate promjene, pa učitaj svježe stanje
    await runQueue();
    db = await fetchAll(agencyId);
    // Nesačuvane promjene (ako red nije ispražnjen) primijeni preko serverskih
    const cached = queue.length ? cachedAgencyData(agencyId) : null;
    if (cached) db = cached;
  } catch (e) {
    const cached = cachedAgencyData(agencyId);
    if (!cached) throw e;
    db = cached;
    offline = true;
  }
  connectRemote(remoteAdapter, db, agencyId);

  channel = sb()
    .channel(`agency-${agencyId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `agency_id=eq.${agencyId}` }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as { id?: string }).id;
        if (id && !pendingIds.has(id)) applyRemoteDelete(id);
        return;
      }
      const row = payload.new as { id: string; kind: Kind; data: never };
      if (!pendingIds.has(row.id) && KINDS.includes(row.kind)) applyRemoteUpsert(row.kind, row.data);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agencies', filter: `id=eq.${agencyId}` }, (payload) => {
      const row = payload.new as { name: string; settings: Settings };
      if (!queue.some((op) => op.t === 'settings')) applyRemoteSettings({ ...row.settings, agencyName: row.name });
    })
    .subscribe((st) => {
      if (st === 'SUBSCRIBED') void resync();
    });
  return { offline };
}

export async function closeAgency() {
  if (channel) await sb().removeChannel(channel);
  channel = null;
  agency = '';
  queue = [];
  pendingIds.clear();
  disconnectRemote();
  setStatus({ state: 'idle', pending: 0 });
}

/**
 * Priprema lokalne podatke za server: server zahtijeva UUID identifikatore,
 * pa se stariji id-jevi zamjenjuju (zajedno sa referencama na njih).
 */
export function withUuids(db: DB): DB {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const map = new Map<string, string>();
  const fix = (id: string) => {
    if (re.test(id)) return id;
    if (!map.has(id)) map.set(id, uid());
    return map.get(id)!;
  };
  const ref = (id?: string) => (id ? fix(id) : id);
  return {
    ...db,
    vehicles: db.vehicles.map((v) => ({ ...v, id: fix(v.id) })),
    customers: db.customers.map((c) => ({ ...c, id: fix(c.id) })),
    rentals: db.rentals.map((r) => ({ ...r, id: fix(r.id), vehicleId: fix(r.vehicleId), customerId: fix(r.customerId) })),
    expenses: db.expenses.map((e) => ({ ...e, id: fix(e.id), vehicleId: ref(e.vehicleId) })),
  };
}
