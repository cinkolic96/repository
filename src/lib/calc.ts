import type { DB, Expense, Rental, Vehicle } from './types';

const DAY = 24 * 60 * 60 * 1000;
/** Tolerancija pri povratu prije nego što se računa novi dan (minuta) */
export const GRACE_MINUTES = 59;

export function toDate(s: string): Date {
  // 'YYYY-MM-DD' i 'YYYY-MM-DDTHH:mm' tretiramo kao lokalno vrijeme
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00');
  return new Date(s);
}

/** Broj obračunskih dana: svaki započeti 24h period (uz toleranciju), minimum 1. */
export function rentalDays(start: string, end: string): number {
  const ms = toDate(end).getTime() - toDate(start).getTime() - GRACE_MINUTES * 60 * 1000;
  return Math.max(1, Math.ceil(ms / DAY));
}

export function extrasTotal(r: Pick<Rental, 'extras' | 'start' | 'end'>): number {
  const d = rentalDays(r.start, r.end);
  return r.extras.reduce((s, e) => s + (e.perDay ? e.price * d : e.price), 0);
}

export function rentalTotal(
  r: Pick<Rental, 'dailyRate' | 'extras' | 'start' | 'end' | 'discount' | 'deliveryFee' | 'extraCharges'>,
): number {
  const base = rentalDays(r.start, r.end) * r.dailyRate;
  return round2(base + extrasTotal(r) + (r.deliveryFee || 0) + (r.extraCharges || 0) - (r.discount || 0));
}

export function rentalPaid(r: Pick<Rental, 'payments'>): number {
  return round2(r.payments.reduce((s, p) => s + p.amount, 0));
}

export function rentalBalance(r: Rental): number {
  if (r.status === 'otkazano') return round2(-rentalPaid(r));
  return round2(rentalTotal(r) - rentalPaid(r));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toDate(aStart) < toDate(bEnd) && toDate(bStart) < toDate(aEnd);
}

/** Rezervacije/izdavanja koja se preklapaju s datim periodom za isto vozilo. */
export function findConflicts(
  rentals: Rental[],
  vehicleId: string,
  start: string,
  end: string,
  ignoreId?: string,
): Rental[] {
  return rentals.filter(
    (r) =>
      r.id !== ignoreId &&
      r.vehicleId === vehicleId &&
      (r.status === 'rezervisano' || r.status === 'aktivno') &&
      overlaps(r.start, r.end, start, end),
  );
}

export function isLate(r: Rental, now = new Date()): boolean {
  return r.status === 'aktivno' && toDate(r.end) < now;
}

export type VehicleState = 'dostupno' | 'izdato' | 'rezervisano_danas' | 'van_upotrebe';

export function currentRental(rentals: Rental[], vehicleId: string): Rental | undefined {
  return rentals.find((r) => r.vehicleId === vehicleId && r.status === 'aktivno');
}

export function nextReservation(rentals: Rental[], vehicleId: string, now = new Date()): Rental | undefined {
  return rentals
    .filter((r) => r.vehicleId === vehicleId && r.status === 'rezervisano' && toDate(r.end) >= now)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
}

export function vehicleState(v: Vehicle, rentals: Rental[], now = new Date()): VehicleState {
  if (v.outOfService) return 'van_upotrebe';
  if (currentRental(rentals, v.id)) return 'izdato';
  const next = nextReservation(rentals, v.id, now);
  if (next && sameDay(toDate(next.start), now)) return 'rezervisano_danas';
  return 'dostupno';
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function daysUntil(dateStr: string, now = new Date()): number {
  const d = toDate(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today.getTime()) / DAY);
}

export interface Alert {
  level: 'critical' | 'warning' | 'info';
  text: string;
  link?: string;
}

export function buildAlerts(db: DB, now = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const warn = db.settings.warnDays;
  const vName = (v: Vehicle) => `${v.make} ${v.model} (${v.plate})`;

  for (const v of db.vehicles) {
    if (v.archived) continue;
    const docs: [string | undefined, string][] = [
      [v.registrationExpiry, 'Registracija'],
      [v.insuranceExpiry, 'Osiguranje'],
      [v.cascoExpiry, 'Kasko'],
      [v.technicalExpiry, 'Tehnički pregled'],
    ];
    for (const [date, label] of docs) {
      if (!date) continue;
      const d = daysUntil(date, now);
      if (d < 0) alerts.push({ level: 'critical', text: `${label} istekla prije ${-d} dana – ${vName(v)}`, link: `/vozila/${v.id}` });
      else if (d <= warn) alerts.push({ level: 'warning', text: `${label} ističe za ${d} dana – ${vName(v)}`, link: `/vozila/${v.id}` });
    }
    if (v.nextServiceKm && v.mileage >= v.nextServiceKm - 1000) {
      const left = v.nextServiceKm - v.mileage;
      alerts.push({
        level: left <= 0 ? 'critical' : 'warning',
        text: left <= 0 ? `Servis prekoračen za ${-left} km – ${vName(v)}` : `Servis za ${left} km – ${vName(v)}`,
        link: `/vozila/${v.id}`,
      });
    }
  }

  const vById = new Map(db.vehicles.map((v) => [v.id, v]));
  for (const r of db.rentals) {
    const v = vById.get(r.vehicleId);
    const label = v ? vName(v) : 'vozilo';
    if (isLate(r, now)) {
      alerts.push({ level: 'critical', text: `Kasni povrat: ${r.number} – ${label}`, link: `/izdavanja/${r.id}` });
    }
    if (r.status === 'rezervisano' && toDate(r.start) < now) {
      alerts.push({ level: 'warning', text: `Rezervacija ${r.number} nije preuzeta (početak ${fmtDateTime(r.start)})`, link: `/izdavanja/${r.id}` });
    }
    if (r.status === 'zavrseno' && rentalBalance(r) > 0) {
      alerts.push({ level: 'warning', text: `Nenaplaćeno ${rentalBalance(r).toFixed(2)} – ${r.number}`, link: `/izdavanja/${r.id}` });
    }
    if (r.status === 'zavrseno' && r.deposit > 0 && !r.depositReturned) {
      alerts.push({ level: 'info', text: `Depozit nije vraćen – ${r.number}`, link: `/izdavanja/${r.id}` });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

/** Prihod izdavanja raspoređen po danima u periodu [from, to) */
export function revenueInPeriod(r: Rental, from: Date, to: Date): number {
  if (r.status === 'otkazano') return 0;
  const s = toDate(r.start).getTime();
  const e = Math.max(toDate(r.end).getTime(), s + 1);
  const ov = Math.max(0, Math.min(e, to.getTime()) - Math.max(s, from.getTime()));
  return (rentalTotal(r) * ov) / (e - s);
}

export function expensesInPeriod(expenses: Expense[], from: Date, to: Date, vehicleId?: string): number {
  return expenses
    .filter((x) => (!vehicleId || x.vehicleId === vehicleId) && toDate(x.date) >= from && toDate(x.date) < to)
    .reduce((s, x) => s + x.amount, 0);
}

export interface MonthRow {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  rentedDays: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

export function monthlyReport(db: DB, year: number, vehicleId?: string): MonthRow[] {
  const rows: MonthRow[] = [];
  for (let m = 0; m < 12; m++) {
    const from = new Date(year, m, 1);
    const to = new Date(year, m + 1, 1);
    const rentals = db.rentals.filter((r) => r.status !== 'otkazano' && (!vehicleId || r.vehicleId === vehicleId));
    const revenue = rentals.reduce((s, r) => s + revenueInPeriod(r, from, to), 0);
    const expenses = expensesInPeriod(db.expenses, from, to, vehicleId);
    const rentedDays = rentals.reduce((s, r) => s + overlapDays(r.start, r.end, from, to), 0);
    rows.push({ key: `${year}-${m}`, label: MONTHS[m], revenue: round2(revenue), expenses: round2(expenses), profit: round2(revenue - expenses), rentedDays });
  }
  return rows;
}

export function overlapDays(start: string, end: string, from: Date, to: Date): number {
  const ov = Math.min(toDate(end).getTime(), to.getTime()) - Math.max(toDate(start).getTime(), from.getTime());
  return ov > 0 ? ov / DAY : 0;
}

export interface VehicleReport {
  vehicle: Vehicle;
  revenue: number;
  expenses: number;
  profit: number;
  rentals: number;
  rentedDays: number;
  utilization: number;
}

export function vehicleReport(db: DB, from: Date, to: Date): VehicleReport[] {
  const periodDays = (to.getTime() - from.getTime()) / DAY;
  return db.vehicles
    .filter((v) => !v.archived)
    .map((v) => {
      const rs = db.rentals.filter((r) => r.vehicleId === v.id && r.status !== 'otkazano');
      const inPeriod = rs.filter((r) => overlapDays(r.start, r.end, from, to) > 0);
      const revenue = rs.reduce((s, r) => s + revenueInPeriod(r, from, to), 0);
      const expenses = expensesInPeriod(db.expenses, from, to, v.id);
      const rentedDays = rs.reduce((s, r) => s + overlapDays(r.start, r.end, from, to), 0);
      return {
        vehicle: v,
        revenue: round2(revenue),
        expenses: round2(expenses),
        profit: round2(revenue - expenses),
        rentals: inPeriod.length,
        rentedDays: Math.round(rentedDays * 10) / 10,
        utilization: periodDays > 0 ? Math.min(1, rentedDays / periodDays) : 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

export function fmtMoney(n: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('sr-Latn-ME', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function fmtDate(s?: string): string {
  if (!s) return '—';
  const d = toDate(s);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
}

export function fmtDateTime(s?: string): string {
  if (!s) return '—';
  const d = toDate(s);
  return `${fmtDate(s)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isoDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoDateTime(d = new Date()): string {
  return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
