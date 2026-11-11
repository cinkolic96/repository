import { useSyncExternalStore } from 'react';
import type { Customer, DB, Expense, Rental, Settings, Vehicle } from './types';

/**
 * Sloj za podatke. Trenutno se čuva lokalno (localStorage) da aplikacija radi
 * odmah i offline. Sve izmjene idu kroz funkcije ispod, pa se kasnije isti API
 * može prebaciti na server (npr. Supabase/Firebase) bez promjene ekrana.
 */

const KEY = 'rentacar-db-v1';
export const DB_VERSION = 1;

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

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw) as DB;
    return { ...emptyDB(), ...parsed, settings: { ...defaultSettings, ...parsed.settings } };
  } catch {
    return emptyDB();
  }
}

let state: DB = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Snimanje nije uspjelo', e);
    alert('Snimanje podataka nije uspjelo (memorija puna?). Napravite rezervnu kopiju u Podešavanjima.');
  }
}

function set(next: DB) {
  state = next;
  persist();
  listeners.forEach((l) => l());
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
  // Sinhronizacija između više otvorenih tabova
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type Coll = 'vehicles' | 'customers' | 'rentals' | 'expenses';
type ItemOf<C extends Coll> = DB[C][number];

function upsert<C extends Coll>(coll: C, item: ItemOf<C>) {
  const list = state[coll] as ItemOf<C>[];
  const exists = list.some((x) => x.id === item.id);
  const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
  set({ ...state, [coll]: next });
}

function remove(coll: Coll, id: string) {
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
  remove('vehicles', id);
  set({ ...state, expenses: state.expenses.map((e) => (e.vehicleId === id ? { ...e, vehicleId: undefined } : e)) });
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

export function importJSON(json: string) {
  const parsed = JSON.parse(json) as DB;
  if (!Array.isArray(parsed.vehicles) || !Array.isArray(parsed.rentals)) throw new Error('Neispravan fajl');
  set({ ...emptyDB(), ...parsed, settings: { ...defaultSettings, ...parsed.settings } });
}

export function replaceDB(db: DB) {
  set(db);
}

export function resetDB() {
  set(emptyDB());
}
