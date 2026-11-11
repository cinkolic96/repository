import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Field, Modal, PageHead, num, useMoney } from '../components/ui';
import { CustomerFields, emptyCustomer } from './CustomerForm';
import { addDays, extrasTotal, findConflicts, fmtDateTime, isLate, isoDate, isoDateTime, rentalDays, rentalTotal, toDate } from '../lib/calc';
import { paymentLabels, sourceOptions } from '../lib/labels';
import { getDB, nextRentalNumber, saveCustomer, saveRental, uid, useDB } from '../lib/store';
import type { Customer, Extra, PaymentMethod, Rental } from '../lib/types';

const COMMON_EXTRAS: Extra[] = [
  { name: 'Dječije sjedište', price: 5, perDay: true },
  { name: 'GPS navigacija', price: 4, perDay: true },
  { name: 'Dodatni vozač', price: 5, perDay: true },
  { name: 'Puno osiguranje (bez učešća)', price: 10, perDay: true },
  { name: 'Zeleni karton / izlazak iz zemlje', price: 30, perDay: false },
];

function newRental(vehicleId: string, start: string, customerId = ''): Rental {
  const s = start || (() => { const d = addDays(new Date(), 1); d.setHours(10, 0, 0, 0); return isoDateTime(d); })();
  const e = addDays(toDate(s), 3);
  const v = getDB().vehicles.find((x) => x.id === vehicleId);
  const loc = getDB().settings.locations[0] ?? '';
  return {
    id: uid(),
    number: nextRentalNumber(),
    vehicleId,
    customerId,
    start: s,
    end: isoDateTime(e),
    pickupLocation: loc,
    returnLocation: loc,
    dailyRate: v?.dailyRate ?? 0,
    extras: [],
    discount: 0,
    deliveryFee: 0,
    deposit: v?.deposit ?? 0,
    depositReturned: false,
    payments: [],
    status: 'rezervisano',
    extraCharges: 0,
    createdAt: isoDateTime(),
  };
}

export default function RentalForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const db = useDB();
  const nav = useNavigate();
  const money = useMoney();
  const existing = id ? db.rentals.find((r) => r.id === id) : undefined;
  const [r, setR] = useState<Rental>(() => existing ?? newRental(params.get('vozilo') ?? '', params.get('od') ?? '', params.get('klijent') ?? ''));
  const [initialPay, setInitialPay] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('gotovina');
  const [newCust, setNewCust] = useState<Customer | null>(null);
  const [error, setError] = useState('');

  if (id && !existing) return <div className="empty">Izdavanje nije pronađeno.</div>;

  const up = (p: Partial<Rental>) => setR((x) => ({ ...x, ...p }));
  const vehicles = db.vehicles.filter((v) => !v.archived || v.id === r.vehicleId);
  const vehicle = db.vehicles.find((v) => v.id === r.vehicleId);
  const customer = db.customers.find((c) => c.id === r.customerId);
  const validRange = r.start && r.end && toDate(r.end) > toDate(r.start);
  const conflicts = r.vehicleId && validRange ? findConflicts(db.rentals, r.vehicleId, r.start, r.end, r.id) : [];
  const days = validRange ? rentalDays(r.start, r.end) : 0;
  const total = validRange ? rentalTotal(r) : 0;

  const isFree = (vid: string) => !validRange || findConflicts(db.rentals, vid, r.start, r.end, r.id).length === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!r.vehicleId) return setError('Izaberite vozilo.');
    if (!r.customerId) return setError('Izaberite ili dodajte klijenta.');
    if (!validRange) return setError('Datum povrata mora biti poslije datuma preuzimanja.');
    if (conflicts.length) return setError('Vozilo je zauzeto u tom periodu.');
    const payments = [...r.payments];
    if (!existing && num(initialPay) > 0) payments.push({ id: uid(), date: isoDate(), amount: num(initialPay), method: payMethod, note: 'Avans / uplata pri rezervaciji' });
    saveRental({ ...r, payments });
    nav(`/izdavanja/${r.id}`, { replace: true });
  };

  const setExtra = (i: number, p: Partial<Extra>) => up({ extras: r.extras.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  return (
    <>
      <PageHead title={existing ? `Izmjena ${r.number}` : 'Nova rezervacija'} sub={existing ? undefined : `Broj: ${r.number}`} />
      <form onSubmit={submit} className="stack">
        <div className="card card-pad">
          <div className="form">
            <div className="section-title">Vozilo i period</div>
            <Field label="Vozilo *" full>
              <select
                value={r.vehicleId}
                onChange={(e) => {
                  const v = db.vehicles.find((x) => x.id === e.target.value);
                  up({ vehicleId: e.target.value, dailyRate: existing ? r.dailyRate : v?.dailyRate ?? 0, deposit: existing ? r.deposit : v?.deposit ?? 0 });
                }}
              >
                <option value="">— izaberite —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} · {v.plate} · {money(v.dailyRate)}/dan
                    {v.outOfService ? ' · VAN UPOTREBE' : isFree(v.id) ? '' : ' · ZAUZETO'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Preuzimanje – datum i vrijeme *">
              <input type="datetime-local" value={r.start} onChange={(e) => up({ start: e.target.value })} required />
            </Field>
            <Field label="Mjesto preuzimanja">
              <input list="locations" value={r.pickupLocation} onChange={(e) => up({ pickupLocation: e.target.value })} />
            </Field>
            <Field label="Povrat – datum i vrijeme *">
              <input type="datetime-local" value={r.end} onChange={(e) => up({ end: e.target.value })} required />
            </Field>
            <Field label="Mjesto povrata">
              <input list="locations" value={r.returnLocation} onChange={(e) => up({ returnLocation: e.target.value })} />
            </Field>
            <datalist id="locations">{db.settings.locations.map((l) => <option key={l} value={l} />)}</datalist>
            {vehicle?.outOfService && <div className="notice warn full">Ovo vozilo je označeno kao van upotrebe ({vehicle.notes || 'servis'}).</div>}
            {r.vehicleId && db.rentals.some((x) => x.id !== r.id && x.vehicleId === r.vehicleId && isLate(x)) && (
              <div className="notice warn full">Pažnja: ovo vozilo još nije vraćeno sa prethodnog najma (kasni povrat).</div>
            )}
            {conflicts.length > 0 && (
              <div className="notice bad full">
                Vozilo je već zauzeto: {conflicts.map((c) => `${c.number} (${fmtDateTime(c.start)} – ${fmtDateTime(c.end)})`).join(', ')}
              </div>
            )}

            <div className="section-title">Klijent</div>
            <Field label="Klijent *" full>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <select value={r.customerId} onChange={(e) => up({ customerId: e.target.value })}>
                  <option value="">— izaberite —</option>
                  {[...db.customers].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.lastName} {c.firstName} · {c.phone}{c.blacklisted ? ' · CRNA LISTA' : ''}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn" onClick={() => setNewCust(emptyCustomer())}>+ Novi</button>
              </div>
            </Field>
            {customer?.blacklisted && <div className="notice bad full">⚠ Klijent je na crnoj listi: {customer.notes || 'bez napomene'}</div>}
            {customer?.licenseExpiry && validRange && toDate(customer.licenseExpiry) < toDate(r.end) && (
              <div className="notice warn full">Vozačka dozvola klijenta ističe prije kraja najma.</div>
            )}
            <Field label="Dodatni vozač">
              <input value={r.additionalDriver ?? ''} onChange={(e) => up({ additionalDriver: e.target.value })} placeholder="Ime, prezime, br. dozvole" />
            </Field>
            <Field label="Izvor rezervacije">
              <select value={r.source ?? ''} onChange={(e) => up({ source: e.target.value })}>
                <option value="">—</option>
                {sourceOptions.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>

            <div className="section-title">Cijena</div>
            <Field label="Cijena po danu">
              <input inputMode="decimal" value={r.dailyRate} onChange={(e) => up({ dailyRate: num(e.target.value) })} />
            </Field>
            <Field label="Dostava / preuzimanje van poslovnice">
              <input inputMode="decimal" value={r.deliveryFee} onChange={(e) => up({ deliveryFee: num(e.target.value) })} />
            </Field>
            <Field label="Popust (iznos)">
              <input inputMode="decimal" value={r.discount} onChange={(e) => up({ discount: num(e.target.value) })} />
            </Field>
            <Field label="Depozit">
              <input inputMode="decimal" value={r.deposit} onChange={(e) => up({ deposit: num(e.target.value) })} />
            </Field>

            <div className="full">
              <div className="row" style={{ marginBottom: 8 }}>
                <strong className="small">Dodaci</strong>
                <select style={{ width: 'auto' }} value="" onChange={(e) => {
                  const ex = COMMON_EXTRAS.find((x) => x.name === e.target.value);
                  up({ extras: [...r.extras, ex ? { ...ex } : { name: '', price: 0, perDay: false }] });
                }}>
                  <option value="">+ dodaj…</option>
                  {COMMON_EXTRAS.map((x) => <option key={x.name}>{x.name}</option>)}
                  <option value="__custom">Drugo…</option>
                </select>
              </div>
              {r.extras.map((x, i) => (
                <div className="row" key={i} style={{ marginBottom: 6, flexWrap: 'nowrap' }}>
                  <input value={x.name} placeholder="Naziv" onChange={(e) => setExtra(i, { name: e.target.value })} />
                  <input style={{ width: 90 }} inputMode="decimal" value={x.price} onChange={(e) => setExtra(i, { price: num(e.target.value) })} />
                  <label className="check"><input type="checkbox" checked={x.perDay} onChange={(e) => setExtra(i, { perDay: e.target.checked })} />/dan</label>
                  <button type="button" className="btn small danger" onClick={() => up({ extras: r.extras.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>

            {!existing && (
              <>
                <Field label="Uplaćeno odmah (avans)">
                  <input inputMode="decimal" value={initialPay} onChange={(e) => setInitialPay(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Način plaćanja">
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                    {Object.entries(paymentLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </Field>
              </>
            )}
            <Field label="Napomena" full>
              <textarea value={r.notes ?? ''} onChange={(e) => up({ notes: e.target.value })} />
            </Field>
          </div>
        </div>

        <div className="card card-pad">
          <dl className="details">
            <dt>Broj dana</dt><dd>{days}</dd>
            <dt>Najam</dt><dd>{days} × {money(r.dailyRate)} = {money(days * r.dailyRate)}</dd>
            {r.extras.length > 0 && <><dt>Dodaci</dt><dd>{money(validRange ? extrasTotal(r) : 0)}</dd></>}
            {r.deliveryFee > 0 && <><dt>Dostava</dt><dd>{money(r.deliveryFee)}</dd></>}
            {r.discount > 0 && <><dt>Popust</dt><dd>−{money(r.discount)}</dd></>}
            <dt><strong>Ukupno</strong></dt><dd><strong style={{ fontSize: '1.2rem' }}>{money(total)}</strong></dd>
          </dl>
        </div>

        {error && <div className="notice bad">{error}</div>}
        <div className="row">
          <button className="btn primary" type="submit">Sačuvaj</button>
          <button className="btn" type="button" onClick={() => nav(-1)}>Odustani</button>
        </div>
      </form>

      {newCust && (
        <Modal
          title="Novi klijent"
          onClose={() => setNewCust(null)}
          footer={
            <>
              <button className="btn" onClick={() => setNewCust(null)}>Odustani</button>
              <button
                className="btn primary"
                onClick={() => {
                  if (!newCust.firstName || !newCust.lastName || !newCust.phone) return alert('Ime, prezime i telefon su obavezni.');
                  saveCustomer(newCust);
                  up({ customerId: newCust.id });
                  setNewCust(null);
                }}
              >
                Sačuvaj klijenta
              </button>
            </>
          }
        >
          <div className="form"><CustomerFields c={newCust} onChange={setNewCust} /></div>
        </Modal>
      )}
    </>
  );
}
