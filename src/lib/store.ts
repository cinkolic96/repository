import { useSyncExternalStore } from 'react';
import type { Customer, DB, Expense, Rental, Settings, Vehicle } from './types';

/**
 * Sloj za podatke.
 *
 * Ekrani čitaju stanje preko useDB() i mijenjaju ga funkcijama ispod. Gdje se
 * podaci čuvaju zavisi od režima:
 *  - lokalno: localStorage na ovom uređaju
 *  - server: svaka promjena se (preko registrovanog `Remote` adaptera) šalje
 *    na server; promjene drugih korisnika stižu kroz applyRemote*().
 */

const LOCAL_KEY = 'rentacar-db-v1';
export const DB_VERSION = 1;

export type Kind = 'vehicles' | 'customers' | 'rentals' | 'expenses';
export const KINDS: Kind[] = ['vehicles', 'customers', 'rentals', 'expenses'];
type ItemOf<C extends Kind> = DB[C][number];
type AnyItem = Vehicle | Customer | Rental | Expense;

export const defaultSettings: Settings = {
  agencyName: 'Moja Rent-a-Car agencija',
  currency: 'EUR',
  locations: ['Poslovnica', 'Aerodrom Podgorica', 'Aerodrom Tivat', 'Hotel / adresa klijenta'],
  warnDays: 30,
  contractTerms:
    '1. Korisnik preuzima vozilo u ispravnom stanju i obavezuje se da ga vrati u istom stanju, sa istom količinom goriva.\n' +
    '2. Zabranjeno je upravljanje vozilom pod dejstvom alkohola ili opojnih sredstava.\n' +
    '3. Korisnik snosi troškove saobraćajnih prekršaja i kazni nastalih u periodu najma.\n' +
    '4. Kašnjenje sa povratom duže od 1 sata naplaćuje se kao dodatni dan.\n' +
    '5. U slučaju štete korisnik je dužan odmah obavijestiti agenciju i policiju.\n' +
    '6. Izlazak iz zemlje dozvoljen je samo uz pisanu saglasnost agencije.',
};

export function emptyDB(): DB {
  return { version: DB_VERSION, vehicles: [], customers: [], rentals: [], expenses: [], settings: defaultSettings };
}

export function normalizeDB(parsed: Partial<DB>): DB {
  return { ...emptyDB(), ...parsed, settings: { ...defaultSettings, ...(parsed.settings ?? {}) } };
}

function readLocal(key = LOCAL_KEY): DB | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? normalizeDB(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Podaci sačuvani lokalno na ovom uređaju (prije prelaska na server). */
export function localDeviceData(): DB | null {
  const db = readLocal();
  if (!db) return null;
  const count = db.vehicles.length + db.customers.length + db.rentals.length + db.expenses.length;
  return count > 0 ? db : null;
}

/**
 * Poslije prenosa na server lokalne podatke čuvamo pod drugim ključem (kao
 * rezervu), da se ne bi ponovo nudio prenos i napravili duplikati.
 */
export function markLocalMigrated() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) localStorage.setItem(`${LOCAL_KEY}-preneseno-${new Date().toISOString().slice(0, 10)}`, raw);
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignoriši */
  }
}

// ---------- Adapter za server ----------

export interface Remote {
  upsert(kind: Kind, items: AnyItem[]): void;
  remove(ids: string[]): void;
  saveSettings(s: Settings): void;
}

let remote: Remote | null = null;
let cacheKey: string | null = null;

let state: DB = readLocal() ?? emptyDB();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  const key = remote ? cacheKey : LOCAL_KEY;
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.error('Snimanje nije uspjelo', e);
    if (!remote) alert('Snimanje podataka nije uspjelo (memorija puna?). Napravite rezervnu kopiju u Podešavanjima.');
  }
}

/** Šalje serveru samo ono što se promijenilo između dva stanja. */
function pushDiff(prev: DB, next: DB) {
  if (!remote) return;
  const removed: string[] = [];
  for (const kind of KINDS) {
    const before = new Map((prev[kind] as AnyItem[]).map((x) => [x.id, x]));
    const changed: AnyItem[] = [];
    for (const item of next[kind] as AnyItem[]) {
      if (before.get(item.id) !== item) changed.push(item);
      before.delete(item.id);
    }
    if (changed.length) remote.upsert(kind, changed);
    removed.push(...before.keys());
  }
  if (removed.length) remote.remove(removed);
  if (prev.settings !== next.settings) remote.saveSettings(next.settings);
}

function set(next: DB) {
  const prev = state;
  state = next;
  pushDiff(prev, next);
  persist();
  emit();
}

/** Uključuje režim servera sa učitanim podacima agencije. */
export function connectRemote(r: Remote, db: DB, agencyId: string) {
  remote = r;
  cacheKey = `rentacar-cache-${agencyId}`;
  state = db;
  persist();
  emit();
}

/** Keš podataka agencije (za rad kad nema interneta). */
export function cachedAgencyData(agencyId: string): DB | null {
  return readLocal(`rentacar-cache-${agencyId}`);
}

export function disconnectRemote() {
  remote = null;
  cacheKey = null;
  state = emptyDB();
  emit();
}

/** Promjena koja je stigla sa servera (drugi korisnik/uređaj) – ne šalje se nazad. */
export function applyRemoteUpsert(kind: Kind, item: AnyItem) {
  const list = state[kind] as AnyItem[];
  const cur = list.find((x) => x.id === item.id);
  if (cur && JSON.stringify(cur) === JSON.stringify(item)) return;
  const next = cur ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
  state = { ...state, [kind]: next };
  persist();
  emit();
}

export function applyRemoteDelete(id: string) {
  let changed = false;
  const next = { ...state };
  for (const kind of KINDS) {
    const list = state[kind] as AnyItem[];
    if (list.some((x) => x.id === id)) {
      (next as Record<Kind, AnyItem[]>)[kind] = list.filter((x) => x.id !== id);
      changed = true;
    }
  }
  if (!changed) return;
  state = next;
  persist();
  emit();
}

export function applyRemoteSettings(s: Settings) {
  if (JSON.stringify(s) === JSON.stringify(state.settings)) return;
  state = { ...state, settings: { ...defaultSettings, ...s } };
  persist();
  emit();
}

export function getDB(): DB {
  return state;
}

export function useDB(): DB {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

if (typeof window !== 'undefined') {
  // Sinhronizacija između više otvorenih tabova (lokalni režim)
  window.addEventListener('storage', (e) => {
    if (!remote && e.key === LOCAL_KEY) {
      state = readLocal() ?? emptyDB();
      emit();
    }
  });
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Rezervna varijanta – UUID v4 format (server očekuje uuid)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function upsert<C extends Kind>(coll: C, item: ItemOf<C>) {
  const list = state[coll] as ItemOf<C>[];
  const exists = list.some((x) => x.id === item.id);
  const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
  set({ ...state, [coll]: next });
}

function remove(coll: Kind, id: string) {
  set({ ...state, [coll]: (state[coll] as { id: string }[]).filter((x) => x.id !== id) });
}

export const saveVehicle = (v: Vehicle) => upsert('vehicles', v);
export const saveCustomer = (c: Customer) => upsert('customers', c);
export const saveExpense = (e: Expense) => upsert('expenses', e);
export const deleteExpense = (id: string) => remove('expenses', id);

export function saveRental(r: Rental) {
  upsert('rentals', r);
  // Ažuriraj kilometražu vozila pri povratu
  if (r.mileageIn) {
    const v = state.vehicles.find((x) => x.id === r.vehicleId);
    if (v && r.mileageIn > v.mileage) upsert('vehicles', { ...v, mileage: r.mileageIn });
  }
}

export function deleteRental(id: string) {
  remove('rentals', id);
}

export function deleteVehicle(id: string): string | null {
  if (state.rentals.some((r) => r.vehicleId === id)) return 'Vozilo ima izdavanja – umjesto brisanja ga arhivirajte.';
  set({
    ...state,
    vehicles: state.vehicles.filter((v) => v.id !== id),
    expenses: state.expenses.map((e) => (e.vehicleId === id ? { ...e, vehicleId: undefined } : e)),
  });
  return null;
}

export function deleteCustomer(id: string): string | null {
  if (state.rentals.some((r) => r.customerId === id)) return 'Klijent ima izdavanja i ne može se obrisati.';
  remove('customers', id);
  return null;
}

export function saveSettings(s: Settings) {
  set({ ...state, settings: s });
}

export function nextRentalNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const max = state.rentals
    .filter((r) => r.number.startsWith(prefix))
    .reduce((m, r) => Math.max(m, parseInt(r.number.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export function exportJSON(): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(json: string, transform: (db: DB) => DB = (d) => d) {
  const parsed = JSON.parse(json) as DB;
  if (!Array.isArray(parsed.vehicles) || !Array.isArray(parsed.rentals)) throw new Error('Neispravan fajl');
  set(transform(normalizeDB(parsed)));
}

export function replaceDB(db: DB) {
  set(db);
}

/** Dodaje podatke (npr. sa ovog uređaja) postojećim, bez brisanja. */
export function mergeDB(db: DB) {
  const next = { ...state };
  for (const kind of KINDS) {
    const ids = new Set((state[kind] as AnyItem[]).map((x) => x.id));
    (next as Record<Kind, AnyItem[]>)[kind] = [...(state[kind] as AnyItem[]), ...(db[kind] as AnyItem[]).filter((x) => !ids.has(x.id))];
  }
  set(next);
}

export function resetDB() {
  set({ ...emptyDB(), settings: state.settings });
}
