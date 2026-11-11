import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ExpenseModal from '../components/ExpenseModal';
import { Money, PageHead, StatusBadge } from '../components/ui';
import { daysUntil, fmtDate, fmtDateTime, isLate, overlapDays, rentalTotal, round2 } from '../lib/calc';
import { categoryLabels, expenseLabels, fuelLabels, transmissionLabels } from '../lib/labels';
import { deleteVehicle, saveVehicle, useDB } from '../lib/store';
import type { Expense } from '../lib/types';

function DocDate({ date, warn }: { date?: string; warn: number }) {
  if (!date) return <span className="muted">nije uneseno</span>;
  const d = daysUntil(date);
  return (
    <>
      {fmtDate(date)}{' '}
      {d < 0 ? <span className="badge bad">istekla</span> : d <= warn ? <span className="badge warn">za {d} dana</span> : <span className="badge good">važi</span>}
    </>
  );
}

export default function VehicleDetail() {
  const { id } = useParams();
  const db = useDB();
  const nav = useNavigate();
  const [tab, setTab] = useState<'rentals' | 'expenses'>('rentals');
  const [expense, setExpense] = useState<Expense | 'new' | null>(null);
  const v = db.vehicles.find((x) => x.id === id);
  if (!v) return <div className="empty">Vozilo nije pronađeno.</div>;

  const rentals = db.rentals.filter((r) => r.vehicleId === v.id).sort((a, b) => b.start.localeCompare(a.start));
  const done = rentals.filter((r) => r.status !== 'otkazano');
  const expenses = db.expenses.filter((e) => e.vehicleId === v.id).sort((a, b) => b.date.localeCompare(a.date));
  const revenue = round2(done.reduce((s, r) => s + rentalTotal(r), 0));
  const cost = round2(expenses.reduce((s, e) => s + e.amount, 0));
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const now = new Date();
  const daysThisYear = done.reduce((s, r) => s + overlapDays(r.start, r.end, yearStart, now), 0);
  const elapsed = Math.max(1, (now.getTime() - yearStart.getTime()) / 86400000);
  const cById = new Map(db.customers.map((c) => [c.id, c]));
  const warn = db.settings.warnDays;

  return (
    <>
      <PageHead
        title={`${v.make} ${v.model}`}
        sub={<span className="mono">{v.plate}{v.archived ? ' · arhivirano' : ''}</span>}
        actions={
          <>
            <Link className="btn primary" to={`/izdavanja/novo?vozilo=${v.id}`}>+ Rezervacija</Link>
            <button className="btn" onClick={() => setExpense('new')}>+ Trošak</button>
            <Link className="btn" to={`/vozila/${v.id}/uredi`}>Izmijeni</Link>
            <button className="btn" onClick={() => saveVehicle({ ...v, outOfService: !v.outOfService })}>
              {v.outOfService ? 'Vrati u upotrebu' : 'Stavi van upotrebe'}
            </button>
            <button className="btn" onClick={() => saveVehicle({ ...v, archived: !v.archived })}>{v.archived ? 'Vrati iz arhive' : 'Arhiviraj'}</button>
            <button className="btn danger" onClick={() => {
              if (!confirm('Obrisati vozilo?')) return;
              const err = deleteVehicle(v.id);
              if (err) alert(err); else nav('/vozila');
            }}>Obriši</button>
          </>
        }
      />
      {v.outOfService && <div className="notice warn" style={{ marginBottom: 16 }}>Vozilo je van upotrebe. {v.notes}</div>}
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">Ukupan prihod</div><div className="value"><Money value={revenue} /></div><div className="hint">{done.length} najmova</div></div>
        <div className="card kpi"><div className="label">Ukupni troškovi</div><div className="value"><Money value={cost} /></div></div>
        <div className="card kpi"><div className="label">Dobit</div><div className="value"><Money value={revenue - cost} colored /></div>
          {v.purchasePrice ? <div className="hint">{Math.round(((revenue - cost) / v.purchasePrice) * 100)}% nabavne cijene vraćeno</div> : null}
        </div>
        <div className="card kpi"><div className="label">Iskorišćenost ove godine</div><div className="value">{Math.round((daysThisYear / elapsed) * 100)}%</div><div className="hint">{Math.round(daysThisYear)} dana u najmu</div></div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card card-pad">
          <dl className="details">
            <dt>Godište</dt><dd>{v.year}</dd>
            <dt>Boja</dt><dd>{v.color || '—'}</dd>
            <dt>Kategorija</dt><dd>{categoryLabels[v.category]}</dd>
            <dt>Gorivo / mjenjač</dt><dd>{fuelLabels[v.fuel]} · {transmissionLabels[v.transmission]}</dd>
            <dt>Sjedišta</dt><dd>{v.seats}</dd>
            <dt>Kilometraža</dt><dd>{v.mileage.toLocaleString('sr-Latn-ME')} km</dd>
            <dt>VIN</dt><dd className="mono">{v.vin || '—'}</dd>
            <dt>Cijena / depozit</dt><dd><Money value={v.dailyRate} />/dan · <Money value={v.deposit} /></dd>
          </dl>
        </div>
        <div className="card card-pad">
          <dl className="details">
            <dt>Registracija</dt><dd><DocDate date={v.registrationExpiry} warn={warn} /></dd>
            <dt>Osiguranje (AO)</dt><dd><DocDate date={v.insuranceExpiry} warn={warn} /></dd>
            <dt>Kasko</dt><dd><DocDate date={v.cascoExpiry} warn={warn} /></dd>
            <dt>Tehnički pregled</dt><dd><DocDate date={v.technicalExpiry} warn={warn} /></dd>
            <dt>Sljedeći servis</dt><dd>{v.nextServiceKm ? `${v.nextServiceKm.toLocaleString('sr-Latn-ME')} km (još ${(v.nextServiceKm - v.mileage).toLocaleString('sr-Latn-ME')} km)` : '—'}</dd>
            {v.purchasePrice ? <><dt>Nabavka</dt><dd><Money value={v.purchasePrice} /> · {fmtDate(v.purchaseDate)}</dd></> : null}
            {v.notes && <><dt>Napomena</dt><dd>{v.notes}</dd></>}
          </dl>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'rentals' ? 'active' : ''} onClick={() => setTab('rentals')}>Izdavanja ({rentals.length})</button>
        <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>Troškovi ({expenses.length})</button>
      </div>
      {tab === 'rentals' ? (
        <div className="card table-wrap">
          {rentals.length === 0 ? <div className="empty">Još nema izdavanja.</div> : (
            <table>
              <thead><tr><th>Broj</th><th>Status</th><th>Klijent</th><th>Preuzimanje</th><th>Povrat</th><th className="num">Iznos</th></tr></thead>
              <tbody>
                {rentals.map((r) => {
                  const c = cById.get(r.customerId);
                  return (
                    <tr key={r.id} className="clickable" onClick={() => nav(`/izdavanja/${r.id}`)}>
                      <td className="mono">{r.number}</td>
                      <td><StatusBadge status={r.status} late={isLate(r)} /></td>
                      <td>{c ? `${c.firstName} ${c.lastName}` : '—'}</td>
                      <td>{fmtDateTime(r.start)}<div className="muted small">{r.pickupLocation}</div></td>
                      <td>{fmtDateTime(r.end)}<div className="muted small">{r.returnLocation}</div></td>
                      <td className="num"><Money value={r.status === 'otkazano' ? 0 : rentalTotal(r)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card table-wrap">
          {expenses.length === 0 ? <div className="empty">Nema troškova.</div> : (
            <table>
              <thead><tr><th>Datum</th><th>Kategorija</th><th>Opis</th><th className="num">Iznos</th></tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => setExpense(e)}>
                    <td>{fmtDate(e.date)}</td>
                    <td>{expenseLabels[e.category]}</td>
                    <td>{e.description || '—'}{e.vendor && <div className="muted small">{e.vendor}</div>}</td>
                    <td className="num"><Money value={e.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {expense && <ExpenseModal initial={expense === 'new' ? undefined : expense} vehicleId={v.id} onClose={() => setExpense(null)} />}
    </>
  );
}
