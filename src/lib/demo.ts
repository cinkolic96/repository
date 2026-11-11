import { addDays, isoDate, isoDateTime } from './calc';
import { defaultSettings, DB_VERSION, uid } from './store';
import type { Customer, DB, Expense, Rental, Vehicle } from './types';

function at(base: Date, dayOffset: number, hour: number): string {
  const d = addDays(base, dayOffset);
  d.setHours(hour, 0, 0, 0);
  return isoDateTime(d);
}

export function demoDB(now = new Date()): DB {
  const created = isoDateTime(now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const v = (p: Partial<Vehicle> & Pick<Vehicle, 'make' | 'model' | 'plate'>): Vehicle => ({
    id: uid(),
    year: 2021,
    category: 'srednji',
    fuel: 'dizel',
    transmission: 'manuelni',
    seats: 5,
    mileage: 60000,
    dailyRate: 35,
    deposit: 200,
    outOfService: false,
    createdAt: created,
    ...p,
  });
  const vehicles: Vehicle[] = [
    v({ make: 'Volkswagen', model: 'Golf 8', plate: 'PG AB123', year: 2022, color: 'Siva', mileage: 41200, dailyRate: 40, registrationExpiry: isoDate(addDays(today, 12)), insuranceExpiry: isoDate(addDays(today, 12)), nextServiceKm: 45000 }),
    v({ make: 'Škoda', model: 'Octavia', plate: 'PG CD456', year: 2021, color: 'Bijela', category: 'limuzina', transmission: 'automatski', mileage: 88300, dailyRate: 45, registrationExpiry: isoDate(addDays(today, 140)), nextServiceKm: 88800 }),
    v({ make: 'Renault', model: 'Clio', plate: 'BD EF789', year: 2020, color: 'Crvena', category: 'mali', fuel: 'benzin', mileage: 72000, dailyRate: 25, deposit: 150, registrationExpiry: isoDate(addDays(today, -3)) }),
    v({ make: 'Dacia', model: 'Duster', plate: 'KO GH321', year: 2023, color: 'Narandžasta', category: 'suv', mileage: 21000, dailyRate: 50, deposit: 300, registrationExpiry: isoDate(addDays(today, 220)) }),
    v({ make: 'Toyota', model: 'Yaris Hybrid', plate: 'PG JK654', year: 2022, color: 'Plava', category: 'mali', fuel: 'hibrid', transmission: 'automatski', mileage: 33000, dailyRate: 38, registrationExpiry: isoDate(addDays(today, 90)), outOfService: true, notes: 'Na servisu – zamjena kočnica' }),
  ];
  const c = (p: Partial<Customer> & Pick<Customer, 'firstName' | 'lastName' | 'phone'>): Customer => ({
    id: uid(),
    idDocumentType: 'pasos',
    idDocumentNumber: 'P' + Math.floor(1e6 + Math.random() * 9e6),
    licenseNumber: 'DL' + Math.floor(1e5 + Math.random() * 9e5),
    blacklisted: false,
    createdAt: created,
    ...p,
  });
  const customers: Customer[] = [
    c({ firstName: 'Marko', lastName: 'Petrović', phone: '+382 67 123 456', email: 'marko@example.com', nationality: 'Crna Gora', idDocumentType: 'licna_karta' }),
    c({ firstName: 'Anna', lastName: 'Schmidt', phone: '+49 151 2345678', nationality: 'Njemačka' }),
    c({ firstName: 'Jovana', lastName: 'Ilić', phone: '+381 64 555 1212', nationality: 'Srbija' }),
    c({ firstName: 'Luka', lastName: 'Novak', phone: '+386 41 222 333', nationality: 'Slovenija', blacklisted: true, notes: 'Vratio vozilo oštećeno, nije platio štetu' }),
  ];
  let n = 1;
  const r = (p: Partial<Rental> & Pick<Rental, 'vehicleId' | 'customerId' | 'start' | 'end' | 'status' | 'dailyRate'>): Rental => ({
    id: uid(),
    number: `${now.getFullYear()}-${String(n++).padStart(4, '0')}`,
    pickupLocation: defaultSettings.locations[0],
    returnLocation: defaultSettings.locations[0],
    extras: [],
    discount: 0,
    deliveryFee: 0,
    deposit: 200,
    depositReturned: false,
    payments: [],
    extraCharges: 0,
    createdAt: created,
    ...p,
  });
  const pay = (amount: number, date: string) => [{ id: uid(), amount, date: date.slice(0, 10), method: 'kartica' as const }];
  const rentals: Rental[] = [
    r({ vehicleId: vehicles[0].id, customerId: customers[1].id, start: at(today, -40, 10), end: at(today, -33, 10), status: 'zavrseno', dailyRate: 40, payments: pay(280, at(today, -40, 10)), depositReturned: true, mileageOut: 39000, mileageIn: 39900, pickupLocation: 'Aerodrom Podgorica', returnLocation: 'Aerodrom Tivat', deliveryFee: 20 }),
    r({ vehicleId: vehicles[1].id, customerId: customers[0].id, start: at(today, -20, 9), end: at(today, -15, 9), status: 'zavrseno', dailyRate: 45, payments: pay(225, at(today, -20, 9)), depositReturned: true }),
    r({ vehicleId: vehicles[0].id, customerId: customers[2].id, start: at(today, -2, 12), end: at(today, 3, 12), status: 'aktivno', dailyRate: 40, extras: [{ name: 'Dječije sjedište', price: 5, perDay: true }], payments: pay(100, at(today, -2, 12)), mileageOut: 40900, fuelOut: 8, pickupLocation: 'Aerodrom Podgorica' }),
    r({ vehicleId: vehicles[3].id, customerId: customers[1].id, start: at(today, -6, 10), end: at(today, -1, 10), status: 'aktivno', dailyRate: 50, deposit: 300, payments: pay(250, at(today, -6, 10)) }),
    r({ vehicleId: vehicles[1].id, customerId: customers[2].id, start: at(today, 0, 15), end: at(today, 4, 15), status: 'rezervisano', dailyRate: 45, pickupLocation: 'Aerodrom Tivat', returnLocation: 'Aerodrom Podgorica', deliveryFee: 25 }),
    r({ vehicleId: vehicles[2].id, customerId: customers[0].id, start: at(today, 5, 9), end: at(today, 12, 9), status: 'rezervisano', dailyRate: 25, discount: 15 }),
  ];
  const e = (p: Omit<Expense, 'id' | 'createdAt'>): Expense => ({ id: uid(), createdAt: created, ...p });
  const expenses: Expense[] = [
    e({ date: isoDate(addDays(today, -35)), category: 'registracija', amount: 320, vehicleId: vehicles[1].id }),
    e({ date: isoDate(addDays(today, -10)), category: 'kvar', amount: 180, vehicleId: vehicles[4].id, description: 'Zamjena kočionih pločica i diskova', vendor: 'Auto servis Kovačević' }),
    e({ date: isoDate(addDays(today, -8)), category: 'pranje', amount: 25, vehicleId: vehicles[0].id }),
    e({ date: isoDate(addDays(today, -5)), category: 'zakup_prostora', amount: 400, description: 'Zakup poslovnice' }),
  ];
  return { version: DB_VERSION, vehicles, customers, rentals, expenses, settings: defaultSettings };
}
