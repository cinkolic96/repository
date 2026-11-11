import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Field, PageHead } from '../components/ui';
import { isoDateTime } from '../lib/calc';
import { saveCustomer, uid, useDB } from '../lib/store';
import type { Customer } from '../lib/types';

export function emptyCustomer(): Customer {
  return {
    id: uid(),
    firstName: '',
    lastName: '',
    phone: '',
    idDocumentType: 'licna_karta',
    idDocumentNumber: '',
    licenseNumber: '',
    blacklisted: false,
    createdAt: isoDateTime(),
  };
}

export function CustomerFields({ c, onChange }: { c: Customer; onChange: (c: Customer) => void }) {
  const up = (p: Partial<Customer>) => onChange({ ...c, ...p });
  return (
    <>
      <Field label="Ime *"><input value={c.firstName} onChange={(e) => up({ firstName: e.target.value })} required /></Field>
      <Field label="Prezime *"><input value={c.lastName} onChange={(e) => up({ lastName: e.target.value })} required /></Field>
      <Field label="Telefon *"><input type="tel" value={c.phone} onChange={(e) => up({ phone: e.target.value })} required /></Field>
      <Field label="Email"><input type="email" value={c.email ?? ''} onChange={(e) => up({ email: e.target.value })} /></Field>
      <Field label="Vrsta dokumenta">
        <select value={c.idDocumentType} onChange={(e) => up({ idDocumentType: e.target.value as Customer['idDocumentType'] })}>
          <option value="licna_karta">Lična karta</option>
          <option value="pasos">Pasoš</option>
        </select>
      </Field>
      <Field label="Broj dokumenta"><input value={c.idDocumentNumber} onChange={(e) => up({ idDocumentNumber: e.target.value })} /></Field>
      <Field label="Broj vozačke dozvole"><input value={c.licenseNumber} onChange={(e) => up({ licenseNumber: e.target.value })} /></Field>
      <Field label="Vozačka važi do"><input type="date" value={c.licenseExpiry ?? ''} onChange={(e) => up({ licenseExpiry: e.target.value || undefined })} /></Field>
      <Field label="Datum rođenja"><input type="date" value={c.birthDate ?? ''} onChange={(e) => up({ birthDate: e.target.value || undefined })} /></Field>
      <Field label="Državljanstvo"><input value={c.nationality ?? ''} onChange={(e) => up({ nationality: e.target.value })} /></Field>
      <Field label="Adresa" full><input value={c.address ?? ''} onChange={(e) => up({ address: e.target.value })} /></Field>
      <Field label="Firma (za pravna lica)"><input value={c.company ?? ''} onChange={(e) => up({ company: e.target.value })} /></Field>
      <Field label="Napomena" full><textarea value={c.notes ?? ''} onChange={(e) => up({ notes: e.target.value })} /></Field>
      <label className="check full"><input type="checkbox" checked={c.blacklisted} onChange={(e) => up({ blacklisted: e.target.checked })} /> Crna lista (ne izdavati vozilo)</label>
    </>
  );
}

export default function CustomerForm() {
  const { id } = useParams();
  const db = useDB();
  const nav = useNavigate();
  const existing = id ? db.customers.find((c) => c.id === id) : undefined;
  const [c, setC] = useState<Customer>(() => existing ?? emptyCustomer());
  if (id && !existing) return <div className="empty">Klijent nije pronađen.</div>;
  return (
    <>
      <PageHead title={existing ? 'Izmjena klijenta' : 'Novi klijent'} />
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          saveCustomer(c);
          nav(`/klijenti/${c.id}`, { replace: true });
        }}
      >
        <div className="card card-pad"><div className="form"><CustomerFields c={c} onChange={setC} /></div></div>
        <div className="row">
          <button className="btn primary" type="submit">Sačuvaj</button>
          <button className="btn" type="button" onClick={() => nav(-1)}>Odustani</button>
        </div>
      </form>
    </>
  );
}
