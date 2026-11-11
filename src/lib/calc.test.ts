import { describe, expect, it } from 'vitest';
import { findConflicts, monthlyReport, rentalBalance, rentalDays, rentalTotal, revenueInPeriod } from './calc';
import { emptyDB } from './store';
import type { Rental } from './types';

const base: Rental = {
  id: 'r1', number: '2026-0001', vehicleId: 'v1', customerId: 'c1',
  start: '2026-03-01T10:00', end: '2026-03-04T10:00',
  pickupLocation: 'A', returnLocation: 'B', dailyRate: 40, extras: [], discount: 0, deliveryFee: 0,
  deposit: 200, depositReturned: false, payments: [], status: 'rezervisano', extraCharges: 0, createdAt: '2026-01-01T00:00',
};

describe('obračun', () => {
  it('broji započete dane uz toleranciju od 59 min', () => {
    expect(rentalDays('2026-03-01T10:00', '2026-03-04T10:00')).toBe(3);
    expect(rentalDays('2026-03-01T10:00', '2026-03-04T10:45')).toBe(3);
    expect(rentalDays('2026-03-01T10:00', '2026-03-04T11:30')).toBe(4);
    expect(rentalDays('2026-03-01T10:00', '2026-03-01T12:00')).toBe(1);
  });
  it('računa ukupno sa dodacima, dostavom i popustom', () => {
    const r = { ...base, extras: [{ name: 'GPS', price: 5, perDay: true }, { name: 'Zeleni karton', price: 30, perDay: false }], deliveryFee: 20, discount: 10 };
    expect(rentalTotal(r)).toBe(3 * 40 + 15 + 30 + 20 - 10);
  });
  it('računa saldo', () => {
    const r = { ...base, payments: [{ id: 'p', date: '2026-03-01', amount: 50, method: 'gotovina' as const }] };
    expect(rentalBalance(r)).toBe(70);
  });
});

describe('preklapanja', () => {
  it('pronalazi konflikt za isto vozilo', () => {
    expect(findConflicts([base], 'v1', '2026-03-03T10:00', '2026-03-05T10:00')).toHaveLength(1);
    expect(findConflicts([base], 'v1', '2026-03-04T10:00', '2026-03-05T10:00')).toHaveLength(0);
    expect(findConflicts([base], 'v2', '2026-03-02T10:00', '2026-03-03T10:00')).toHaveLength(0);
    expect(findConflicts([{ ...base, status: 'otkazano' }], 'v1', '2026-03-02T10:00', '2026-03-03T10:00')).toHaveLength(0);
    expect(findConflicts([base], 'v1', '2026-03-02T10:00', '2026-03-03T10:00', 'r1')).toHaveLength(0);
  });
});

describe('izvještaji', () => {
  it('raspoređuje prihod preko granice mjeseca', () => {
    const r = { ...base, start: '2026-03-30T00:00', end: '2026-04-03T00:00' }; // 4 dana, 160
    expect(revenueInPeriod(r, new Date(2026, 2, 1), new Date(2026, 3, 1))).toBeCloseTo(80);
    const db = { ...emptyDB(), rentals: [r], expenses: [{ id: 'e', date: '2026-04-10', category: 'servis' as const, amount: 50, createdAt: '' }] };
    const rows = monthlyReport(db, 2026);
    expect(rows[3].revenue).toBeCloseTo(80);
    expect(rows[3].expenses).toBe(50);
    expect(rows[3].profit).toBeCloseTo(30);
  });
});
