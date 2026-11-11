import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Money, PageHead, StatusBadge } from '../components/ui';
import { fmtDateTime, isLate, rentalBalance, rentalDays, rentalTotal } from '../lib/calc';
import { useDB } from '../lib/store';
import type { RentalStatus } from '../lib/types';

type Filter = 'sve' | RentalStatus | 'kasni' | 'dug';

export default function Rentals() {
  const db = useDB();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('sve');
  const [q, setQ] = useState('');
  const vById = new Map(db.vehicles.map((v) => [v.id, v]));
  const cById = new Map(db.customers.map((c) => [c.id, c]));

  const list = db.rentals
    .filter((r) => {
      if (filter === 'kasni') return isLate(r);
      if (filter === 'dug') return r.status !== 'otkazano' && rentalBalance(r) > 0;
      return filter === 'sve' || r.status === filter;
    })
    .filter((r) => {
      if (!q) return true;
      const v = vById.get(r.vehicleId);
      const c = cById.get(r.customerId);
      const hay = `${r.number} ${v?.make} ${v?.model} ${v?.plate} ${c?.firstName} ${c?.lastName} ${c?.phone} ${r.pickupLocation} ${r.returnLocation}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    })
    .sort((a, b) => b.start.localeCompare(a.start));

  const filters: [Filter, string][] = [
    ['sve', 'Sve'],
    ['rezervisano', 'Rezervacije'],
    ['aktivno', 'Izdato'],
    ['kasni', 'Kasni'],
    ['dug', 'Nenaplaćeno'],
    ['zavrseno', 'Završeno'],
    ['otkazano', 'Otkazano'],
  ];

  return (
    <>
      <PageHead title="Rezervacije i izdavanja" actions={<Link className="btn primary" to="/izdavanja/novo">+ Nova rezervacija</Link>} />
      <div className="tabs">
        {filters.map(([k, l]) => (
          <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="search" placeholder="Pretraga (broj, klijent, tablice…)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card table-wrap">
        {list.length === 0 ? (
          <div className="empty">Nema rezultata.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Broj</th>
                <th>Status</th>
                <th>Vozilo</th>
                <th>Klijent</th>
                <th>Preuzimanje</th>
                <th>Povrat</th>
                <th className="num">Dana</th>
                <th className="num">Ukupno</th>
                <th className="num">Duguje</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const v = vById.get(r.vehicleId);
                const c = cById.get(r.customerId);
                const bal = rentalBalance(r);
                return (
                  <tr key={r.id} className="clickable" onClick={() => nav(`/izdavanja/${r.id}`)}>
                    <td className="mono">{r.number}</td>
                    <td><StatusBadge status={r.status} late={isLate(r)} /></td>
                    <td>{v ? `${v.make} ${v.model}` : '—'}<div className="muted small mono">{v?.plate}</div></td>
                    <td>{c ? `${c.firstName} ${c.lastName}` : '—'}</td>
                    <td>{fmtDateTime(r.start)}<div className="muted small">{r.pickupLocation}</div></td>
                    <td>{fmtDateTime(r.end)}<div className="muted small">{r.returnLocation}</div></td>
                    <td className="num">{rentalDays(r.start, r.end)}</td>
                    <td className="num"><Money value={r.status === 'otkazano' ? 0 : rentalTotal(r)} /></td>
                    <td className="num">{bal > 0 ? <span className="money-neg"><Money value={bal} /></span> : bal < 0 ? <span className="muted">povrat <Money value={-bal} /></span> : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
