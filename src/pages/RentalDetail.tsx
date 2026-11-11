import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Field, Modal, Money, PageHead, StatusBadge, num, optNum, useMoney } from '../components/ui';
import {
  extrasTotal,
  fmtDate,
  fmtDateTime,
  isLate,
  isoDate,
  isoDateTime,
  rentalBalance,
  rentalDays,
  rentalPaid,
  rentalTotal,
} from '../lib/calc';
import { paymentLabels } from '../lib/labels';
import { deleteRental, saveRental, uid, useDB } from '../lib/store';
import type { PaymentMethod, Rental } from '../lib/types';

const fuelText = (f?: number) => (f === undefined ? '—' : `${f}/8`);

export default function RentalDetail() {
  const { id } = useParams();
  const db = useDB();
  const nav = useNavigate();
  const money = useMoney();
  const [modal, setModal] = useState<'' | 'pay' | 'out' | 'in'>('');
  const r = db.rentals.find((x) => x.id === id);
  if (!r) return <div className="empty">Izdavanje nije pronađeno.</div>;
  const v = db.vehicles.find((x) => x.id === r.vehicleId);
  const c = db.customers.find((x) => x.id === r.customerId);
  const days = rentalDays(r.start, r.end);
  const total = rentalTotal(r);
  const paid = rentalPaid(r);
  const balance = rentalBalance(r);
  const s = db.settings;

  return (
    <>
      <PageHead
        title={`Izdavanje ${r.number}`}
        sub={<StatusBadge status={r.status} late={isLate(r)} />}
        actions={
          <div className="row no-print">
            {r.status === 'rezervisano' && <button className="btn primary" onClick={() => setModal('out')}>Izdaj vozilo</button>}
            {r.status === 'aktivno' && <button className="btn primary" onClick={() => setModal('in')}>Vrati vozilo</button>}
            {r.status !== 'otkazano' && <button className="btn" onClick={() => setModal('pay')}>+ Uplata</button>}
            <button className="btn" onClick={() => window.print()}>Štampaj ugovor</button>
            <Link className="btn" to={`/izdavanja/${r.id}/uredi`}>Izmijeni</Link>
            {r.status === 'rezervisano' && (
              <button className="btn danger" onClick={() => confirm('Otkazati rezervaciju?') && saveRental({ ...r, status: 'otkazano' })}>Otkaži</button>
            )}
            {(r.status === 'otkazano' || r.status === 'zavrseno') && (
              <button className="btn danger" onClick={() => { if (confirm('Trajno obrisati ovo izdavanje?')) { deleteRental(r.id); nav('/izdavanja'); } }}>Obriši</button>
            )}
          </div>
        }
      />

      <div className="grid grid-2 no-print">
        <div className="card">
          <div className="card-head"><h2>Vozilo i period</h2></div>
          <div className="card-pad">
            <dl className="details">
              <dt>Vozilo</dt><dd>{v ? <Link to={`/vozila/${v.id}`}>{v.make} {v.model} · {v.plate}</Link> : '—'}</dd>
              <dt>Preuzimanje</dt><dd>{fmtDateTime(r.start)} · {r.pickupLocation}</dd>
              <dt>Povrat</dt><dd>{fmtDateTime(r.end)} · {r.returnLocation}</dd>
              <dt>Trajanje</dt><dd>{days} {days === 1 ? 'dan' : 'dana'}</dd>
              {r.source && <><dt>Izvor</dt><dd>{r.source}</dd></>}
              <dt>Km pri izdavanju</dt><dd>{r.mileageOut ?? '—'}</dd>
              <dt>Km pri povratu</dt><dd>{r.mileageIn ?? '—'} {r.mileageIn && r.mileageOut ? <span className="muted">({r.mileageIn - r.mileageOut} km pređeno)</span> : null}</dd>
              <dt>Gorivo</dt><dd>{fuelText(r.fuelOut)} → {fuelText(r.fuelIn)}</dd>
              {r.damageNotes && <><dt>Oštećenja</dt><dd>{r.damageNotes}</dd></>}
              {r.notes && <><dt>Napomena</dt><dd>{r.notes}</dd></>}
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Klijent</h2></div>
          <div className="card-pad">
            {c ? (
              <dl className="details">
                <dt>Ime</dt><dd><Link to={`/klijenti/${c.id}`}>{c.firstName} {c.lastName}</Link> {c.blacklisted && <span className="badge bad">Crna lista</span>}</dd>
                <dt>Telefon</dt><dd><a href={`tel:${c.phone}`}>{c.phone}</a></dd>
                {c.email && <><dt>Email</dt><dd>{c.email}</dd></>}
                <dt>Dokument</dt><dd>{c.idDocumentNumber || '—'}</dd>
                <dt>Vozačka</dt><dd>{c.licenseNumber || '—'}</dd>
                {r.additionalDriver && <><dt>Dodatni vozač</dt><dd>{r.additionalDriver}</dd></>}
              </dl>
            ) : '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-2 no-print" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-head"><h2>Obračun</h2></div>
          <div className="card-pad">
            <dl className="details">
              <dt>Najam</dt><dd>{days} × {money(r.dailyRate)} = {money(days * r.dailyRate)}</dd>
              {r.extras.map((x, i) => (
                <span key={i} style={{ display: 'contents' }}><dt>{x.name}</dt><dd>{money(x.perDay ? x.price * days : x.price)}</dd></span>
              ))}
              {r.deliveryFee > 0 && <><dt>Dostava</dt><dd>{money(r.deliveryFee)}</dd></>}
              {r.extraCharges > 0 && <><dt>Dodatne naplate</dt><dd>{money(r.extraCharges)}</dd></>}
              {r.discount > 0 && <><dt>Popust</dt><dd>−{money(r.discount)}</dd></>}
              <dt><strong>Ukupno</strong></dt><dd><strong>{money(r.status === 'otkazano' ? 0 : total)}</strong></dd>
              <dt>Plaćeno</dt><dd>{money(paid)}</dd>
              <dt><strong>{balance >= 0 ? 'Preostalo' : 'Za povrat klijentu'}</strong></dt>
              <dd><strong className={balance > 0 ? 'money-neg' : 'money-pos'}>{money(Math.abs(balance))}</strong></dd>
              <dt>Depozit</dt>
              <dd>
                {money(r.deposit)}{' '}
                {r.deposit > 0 && (
                  <label className="check" style={{ display: 'inline-flex' }}>
                    <input type="checkbox" checked={r.depositReturned} onChange={(e) => saveRental({ ...r, depositReturned: e.target.checked })} /> vraćen
                  </label>
                )}
              </dd>
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Uplate</h2></div>
          {r.payments.length === 0 ? <div className="empty">Nema uplata.</div> : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {r.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{fmtDate(p.date)}</td>
                      <td>{paymentLabels[p.method]}<div className="muted small">{p.note}</div></td>
                      <td className="num"><Money value={p.amount} /></td>
                      <td className="num">
                        <button className="btn small danger" onClick={() => confirm('Obrisati uplatu?') && saveRental({ ...r, payments: r.payments.filter((x) => x.id !== p.id) })}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Ugovor za štampu */}
      <div className="print-only" style={{ fontSize: 12 }}>
        <h2>{s.agencyName}</h2>
        <div>{[s.address, s.phone, s.email, s.taxId && `PIB: ${s.taxId}`].filter(Boolean).join(' · ')}</div>
        <h1 style={{ margin: '16px 0', textAlign: 'center' }}>UGOVOR O NAJMU VOZILA br. {r.number}</h1>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr><td><strong>Korisnik:</strong> {c?.firstName} {c?.lastName}</td><td><strong>Telefon:</strong> {c?.phone}</td></tr>
            <tr><td><strong>Dokument:</strong> {c?.idDocumentNumber}</td><td><strong>Vozačka:</strong> {c?.licenseNumber} {c?.licenseExpiry && `(do ${fmtDate(c.licenseExpiry)})`}</td></tr>
            <tr><td><strong>Adresa:</strong> {c?.address}</td><td><strong>Datum rođenja:</strong> {fmtDate(c?.birthDate)}</td></tr>
            {r.additionalDriver && <tr><td colSpan={2}><strong>Dodatni vozač:</strong> {r.additionalDriver}</td></tr>}
            <tr><td><strong>Vozilo:</strong> {v?.make} {v?.model} ({v?.color})</td><td><strong>Tablice:</strong> {v?.plate}</td></tr>
            <tr><td><strong>Preuzimanje:</strong> {fmtDateTime(r.start)}, {r.pickupLocation}</td><td><strong>Povrat:</strong> {fmtDateTime(r.end)}, {r.returnLocation}</td></tr>
            <tr><td><strong>Km pri preuzimanju:</strong> {r.mileageOut ?? '______'}</td><td><strong>Gorivo:</strong> {fuelText(r.fuelOut)}</td></tr>
            <tr><td><strong>Cijena:</strong> {days} dana × {money(r.dailyRate)}{r.extras.length ? ` + dodaci ${money(extrasTotal(r))}` : ''}</td><td><strong>Ukupno:</strong> {money(total)} · <strong>Depozit:</strong> {money(r.deposit)}</td></tr>
            <tr><td><strong>Plaćeno:</strong> {money(paid)}</td><td><strong>Preostalo:</strong> {money(Math.max(0, balance))}</td></tr>
          </tbody>
        </table>
        <h3 style={{ marginTop: 16 }}>Uslovi najma</h3>
        <div style={{ whiteSpace: 'pre-wrap' }}>{s.contractTerms}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 60 }}>
          <div>_________________________<br />Za agenciju</div>
          <div>_________________________<br />Korisnik</div>
        </div>
      </div>

      {modal === 'pay' && <PaymentModal r={r} onClose={() => setModal('')} />}
      {modal === 'out' && <HandoverModal r={r} mileage={v?.mileage} onClose={() => setModal('')} />}
      {modal === 'in' && <ReturnModal r={r} onClose={() => setModal('')} />}
    </>
  );
}

function PaymentModal({ r, onClose }: { r: Rental; onClose: () => void }) {
  const [amount, setAmount] = useState(String(Math.max(0, rentalBalance(r))));
  const [method, setMethod] = useState<PaymentMethod>('gotovina');
  const [date, setDate] = useState(isoDate());
  const [note, setNote] = useState('');
  return (
    <Modal title="Nova uplata" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Odustani</button>
        <button className="btn primary" onClick={() => {
          if (num(amount) === 0) return;
          saveRental({ ...r, payments: [...r.payments, { id: uid(), amount: num(amount), method, date, note }] });
          onClose();
        }}>Sačuvaj</button>
      </>
    }>
      <div className="form">
        <Field label="Iznos" help="Za povrat novca klijentu unesite negativan iznos."><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Datum"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Način plaćanja">
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {Object.entries(paymentLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Napomena"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function HandoverModal({ r, mileage, onClose }: { r: Rental; mileage?: number; onClose: () => void }) {
  const [km, setKm] = useState(String(r.mileageOut ?? mileage ?? ''));
  const [fuel, setFuel] = useState(r.fuelOut ?? 8);
  const [start, setStart] = useState(r.start);
  const [notes, setNotes] = useState(r.damageNotes ?? '');
  return (
    <Modal title="Izdavanje vozila klijentu" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Odustani</button>
        <button className="btn primary" onClick={() => {
          saveRental({ ...r, status: 'aktivno', start, mileageOut: optNum(km), fuelOut: fuel, damageNotes: notes || undefined });
          onClose();
        }}>Potvrdi izdavanje</button>
      </>
    }>
      <div className="form">
        <Field label="Stvarno vrijeme preuzimanja"><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Kilometraža"><input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} /></Field>
        <Field label={`Gorivo: ${fuel}/8`}><input type="range" min={0} max={8} value={fuel} onChange={(e) => setFuel(Number(e.target.value))} /></Field>
        <Field label="Postojeća oštećenja" full><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="npr. ogrebotina zadnji branik" /></Field>
      </div>
    </Modal>
  );
}

function ReturnModal({ r, onClose }: { r: Rental; onClose: () => void }) {
  const money = useMoney();
  const [end, setEnd] = useState(() => {
    const now = isoDateTime();
    return now < r.end ? r.end : now;
  });
  const [recalc, setRecalc] = useState(true);
  const [km, setKm] = useState(r.mileageIn ? String(r.mileageIn) : '');
  const [fuel, setFuel] = useState(r.fuelIn ?? r.fuelOut ?? 8);
  const [charges, setCharges] = useState(String(r.extraCharges || ''));
  const [notes, setNotes] = useState(r.damageNotes ?? '');
  const [depositBack, setDepositBack] = useState(true);
  const preview: Rental = { ...r, end: recalc ? end : r.end, extraCharges: num(charges) };
  const kmNum = optNum(km);
  return (
    <Modal title="Povrat vozila" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Odustani</button>
        <button className="btn primary" onClick={() => {
          if (kmNum !== undefined && r.mileageOut && kmNum < r.mileageOut) return alert('Kilometraža pri povratu je manja od one pri izdavanju.');
          saveRental({ ...preview, status: 'zavrseno', mileageIn: kmNum, fuelIn: fuel, damageNotes: notes || undefined, depositReturned: depositBack });
          onClose();
        }}>Potvrdi povrat</button>
      </>
    }>
      <div className="form">
        <Field label="Stvarno vrijeme povrata"><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        <label className="check"><input type="checkbox" checked={recalc} onChange={(e) => setRecalc(e.target.checked)} /> Obračunaj po stvarnom vremenu povrata</label>
        <Field label="Kilometraža"><input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder={r.mileageOut ? `izdato sa ${r.mileageOut}` : ''} /></Field>
        <Field label={`Gorivo: ${fuel}/8`}><input type="range" min={0} max={8} value={fuel} onChange={(e) => setFuel(Number(e.target.value))} /></Field>
        <Field label="Dodatne naplate (šteta, gorivo, čišćenje…)"><input inputMode="decimal" value={charges} onChange={(e) => setCharges(e.target.value)} /></Field>
        <label className="check"><input type="checkbox" checked={depositBack} onChange={(e) => setDepositBack(e.target.checked)} /> Depozit vraćen klijentu</label>
        <Field label="Oštećenja / napomena" full><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="notice info full">
          Novi obračun: {rentalDays(preview.start, preview.end)} dana · ukupno {money(rentalTotal(preview))} · preostalo za naplatu {money(Math.max(0, rentalTotal(preview) - rentalPaid(preview)))}
        </div>
      </div>
    </Modal>
  );
}
