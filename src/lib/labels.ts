import type {
  ExpenseCategory,
  FuelType,
  PaymentMethod,
  RentalStatus,
  Transmission,
  VehicleCategory,
} from './types';

export const fuelLabels: Record<FuelType, string> = {
  benzin: 'Benzin',
  dizel: 'Dizel',
  hibrid: 'Hibrid',
  elektricni: 'Električni',
  plin: 'Plin (TNG)',
};

export const transmissionLabels: Record<Transmission, string> = {
  manuelni: 'Manuelni',
  automatski: 'Automatski',
};

export const categoryLabels: Record<VehicleCategory, string> = {
  mali: 'Mali grad',
  srednji: 'Srednja klasa',
  limuzina: 'Limuzina',
  suv: 'SUV',
  kombi: 'Kombi',
  luksuzni: 'Luksuzni',
};

export const rentalStatusLabels: Record<RentalStatus, string> = {
  rezervisano: 'Rezervisano',
  aktivno: 'Izdato',
  zavrseno: 'Završeno',
  otkazano: 'Otkazano',
};

export const paymentLabels: Record<PaymentMethod, string> = {
  gotovina: 'Gotovina',
  kartica: 'Kartica',
  virman: 'Virman',
  online: 'Online',
};

export const expenseLabels: Record<ExpenseCategory, string> = {
  registracija: 'Registracija',
  osiguranje: 'Osiguranje',
  servis: 'Redovni servis',
  kvar: 'Kvar / popravka',
  gume: 'Gume',
  gorivo: 'Gorivo',
  pranje: 'Pranje / čišćenje',
  kazna: 'Kazna',
  rata_lizing: 'Rata / lizing',
  plate: 'Plate',
  zakup_prostora: 'Zakup prostora',
  marketing: 'Marketing',
  ostalo: 'Ostalo',
};

export const sourceOptions = ['Direktno', 'Telefon', 'Web sajt', 'Booking platforma', 'Agencija / partner', 'Preporuka'];
