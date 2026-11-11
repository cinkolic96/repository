import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Field, PageHead, num, optNum } from '../components/ui';
import { isoDateTime } from '../lib/calc';
import { categoryLabels, fuelLabels, transmissionLabels } from '../lib/labels';
import { saveVehicle, uid, useDB } from '../lib/store';
import type { FuelType, Transmission, Vehicle, VehicleCategory } from '../lib/types';

function emptyVehicle(): Vehicle {
  return {
    id: uid(),
    make: '',
    model: '',
    year: new Date().getFullYear(),
    plate: '',
    category: 'srednji',
    fuel: 'dizel',
    transmission: 'manuelni',
    seats: 5,
    mileage: 0,
    dailyRate: 30,
    deposit: 200,
    outOfService: false,
    createdAt: isoDateTime(),
  };
}

export default function VehicleForm() {
  const { id } = useParams();
  const db = useDB();
  const nav = useNavigate();
  const existing = id ? db.vehicles.find((v) => v.id === id) : undefined;
  const [v, setV] = useState<Vehicle>(() => existing ?? emptyVehicle());
  const [error, setError] = useState('');
  if (id && !existing) return <div className="empty">Vozilo nije pronađeno.</div>;
  const up = (p: Partial<Vehicle>) => setV((x) => ({ ...x, ...p }));
  const date = (k: keyof Vehicle) => ({
    type: 'date',
    value: (v[k] as string | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => up({ [k]: e.target.value || undefined } as Partial<Vehicle>),
  });

  return (
    <>
      <PageHead title={existing ? `Izmjena: ${existing.make} ${existing.model}` : 'Novo vozilo'} />
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const plate = v.plate.trim().toUpperCase();
          if (db.vehicles.some((x) => x.id !== v.id && x.plate.replace(/\s/g, '') === plate.replace(/\s/g, ''))) {
            return setError('Vozilo sa ovim tablicama već postoji.');
          }
          saveVehicle({ ...v, plate });
          nav(`/vozila/${v.id}`, { replace: true });
        }}
      >
        <div className="card card-pad">
          <div className="form">
            <div className="section-title">Osnovni podaci</div>
            <Field label="Marka *"><input value={v.make} onChange={(e) => up({ make: e.target.value })} required placeholder="npr. Volkswagen" /></Field>
            <Field label="Model *"><input value={v.model} onChange={(e) => up({ model: e.target.value })} required placeholder="npr. Golf 8" /></Field>
            <Field label="Registarske tablice *"><input value={v.plate} onChange={(e) => up({ plate: e.target.value })} required placeholder="PG AB123" /></Field>
            <Field label="Godište"><input inputMode="numeric" value={v.year} onChange={(e) => up({ year: num(e.target.value) })} /></Field>
            <Field label="Boja"><input value={v.color ?? ''} onChange={(e) => up({ color: e.target.value })} /></Field>
            <Field label="Broj šasije (VIN)"><input value={v.vin ?? ''} onChange={(e) => up({ vin: e.target.value })} /></Field>
            <Field label="Kategorija">
              <select value={v.category} onChange={(e) => up({ category: e.target.value as VehicleCategory })}>
                {Object.entries(categoryLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Gorivo">
              <select value={v.fuel} onChange={(e) => up({ fuel: e.target.value as FuelType })}>
                {Object.entries(fuelLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Mjenjač">
              <select value={v.transmission} onChange={(e) => up({ transmission: e.target.value as Transmission })}>
                {Object.entries(transmissionLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Broj sjedišta"><input inputMode="numeric" value={v.seats} onChange={(e) => up({ seats: num(e.target.value) })} /></Field>
            <Field label="Trenutna kilometraža"><input inputMode="numeric" value={v.mileage} onChange={(e) => up({ mileage: num(e.target.value) })} /></Field>

            <div className="section-title">Cijena</div>
            <Field label="Cijena po danu"><input inputMode="decimal" value={v.dailyRate} onChange={(e) => up({ dailyRate: num(e.target.value) })} /></Field>
            <Field label="Depozit"><input inputMode="decimal" value={v.deposit} onChange={(e) => up({ deposit: num(e.target.value) })} /></Field>

            <div className="section-title">Dokumenti i održavanje</div>
            <Field label="Registracija važi do"><input {...date('registrationExpiry')} /></Field>
            <Field label="Osiguranje (AO) važi do"><input {...date('insuranceExpiry')} /></Field>
            <Field label="Kasko važi do"><input {...date('cascoExpiry')} /></Field>
            <Field label="Tehnički pregled važi do"><input {...date('technicalExpiry')} /></Field>
            <Field label="Sljedeći servis na (km)"><input inputMode="numeric" value={v.nextServiceKm ?? ''} onChange={(e) => up({ nextServiceKm: optNum(e.target.value) })} /></Field>

            <div className="section-title">Nabavka (za obračun isplativosti)</div>
            <Field label="Nabavna cijena"><input inputMode="decimal" value={v.purchasePrice ?? ''} onChange={(e) => up({ purchasePrice: optNum(e.target.value) })} /></Field>
            <Field label="Datum nabavke"><input {...date('purchaseDate')} /></Field>

            <label className="check full"><input type="checkbox" checked={v.outOfService} onChange={(e) => up({ outOfService: e.target.checked })} /> Van upotrebe (servis, kvar…) – ne nudi se za rezervacije</label>
            <Field label="Napomena" full><textarea value={v.notes ?? ''} onChange={(e) => up({ notes: e.target.value })} /></Field>
          </div>
        </div>
        {error && <div className="notice bad">{error}</div>}
        <div className="row">
          <button className="btn primary" type="submit">Sačuvaj</button>
          <button className="btn" type="button" onClick={() => nav(-1)}>Odustani</button>
        </div>
      </form>
    </>
  );
}
