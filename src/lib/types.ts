export type ID = string;

export type FuelType = 'benzin' | 'dizel' | 'hibrid' | 'elektricni' | 'plin';
export type Transmission = 'manuelni' | 'automatski';
export type VehicleCategory = 'mali' | 'srednji' | 'limuzina' | 'suv' | 'kombi' | 'luksuzni';

export interface Vehicle {
  id: ID;
  make: string;
  model: string;
  year: number;
  plate: string;
  vin?: string;
  color?: string;
  category: VehicleCategory;
  fuel: FuelType;
  transmission: Transmission;
  seats: number;
  mileage: number;
  dailyRate: number;
  deposit: number;
  /** Datum isteka registracije (YYYY-MM-DD) */
  registrationExpiry?: string;
  insuranceExpiry?: string;
  /** Kasko osiguranje */
  cascoExpiry?: string;
  technicalExpiry?: string;
  /** Sljedeći servis na km */
  nextServiceKm?: number;
  /** Vozilo trenutno van upotrebe (servis, kvar) */
  outOfService: boolean;
  purchasePrice?: number;
  purchaseDate?: string;
  notes?: string;
  archived?: boolean;
  createdAt: string;
}

export interface Customer {
  id: ID;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  idDocumentType: 'licna_karta' | 'pasos';
  idDocumentNumber: string;
  licenseNumber: string;
  licenseExpiry?: string;
  birthDate?: string;
  nationality?: string;
  address?: string;
  company?: string;
  notes?: string;
  blacklisted: boolean;
  createdAt: string;
}

export type RentalStatus = 'rezervisano' | 'aktivno' | 'zavrseno' | 'otkazano';
export type PaymentMethod = 'gotovina' | 'kartica' | 'virman' | 'online';

export interface Extra {
  name: string;
  /** Cijena po danu ili fiksna */
  price: number;
  perDay: boolean;
}

export interface Payment {
  id: ID;
  date: string;
  amount: number;
  method: PaymentMethod;
  note?: string;
}

export interface Rental {
  id: ID;
  number: string;
  vehicleId: ID;
  customerId: ID;
  additionalDriver?: string;
  /** ISO datetime lokalno (YYYY-MM-DDTHH:mm) */
  start: string;
  end: string;
  pickupLocation: string;
  returnLocation: string;
  dailyRate: number;
  extras: Extra[];
  discount: number;
  /** Naknada za dostavu/preuzimanje na drugoj lokaciji */
  deliveryFee: number;
  deposit: number;
  depositReturned: boolean;
  payments: Payment[];
  status: RentalStatus;
  source?: string;
  mileageOut?: number;
  mileageIn?: number;
  fuelOut?: number; // 0-8 osmine
  fuelIn?: number;
  damageNotes?: string;
  /** Dodatne naplate pri povratu (šteta, gorivo, kašnjenje) */
  extraCharges: number;
  notes?: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'registracija'
  | 'osiguranje'
  | 'servis'
  | 'kvar'
  | 'gume'
  | 'gorivo'
  | 'pranje'
  | 'kazna'
  | 'rata_lizing'
  | 'plate'
  | 'zakup_prostora'
  | 'marketing'
  | 'ostalo';

export interface Expense {
  id: ID;
  date: string;
  category: ExpenseCategory;
  amount: number;
  vehicleId?: ID;
  description?: string;
  vendor?: string;
  createdAt: string;
}

export interface Settings {
  agencyName: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  currency: string;
  locations: string[];
  /** Upozorenje koliko dana unaprijed za isteke dokumenata */
  warnDays: number;
  contractTerms: string;
}

export interface DB {
  version: number;
  vehicles: Vehicle[];
  customers: Customer[];
  rentals: Rental[];
  expenses: Expense[];
  settings: Settings;
}
