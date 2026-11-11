import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead, useMoney } from '../components/ui';
import { currentRental, daysUntil, fmtDateTime, isLate, nextReservation, vehicleState } from '../lib/calc';
import { categoryLabels, fuelLabels, transmissionLabels } from '../lib/labels';
import { useDB } from '../lib/store';

export default function Vehicles() {
  const db = useDB();
  const money = useMoney();
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const list = db.vehicles
    .filter((v) => (showArchived ? v.archived : !v.archived))
    .filter((v) => `${v.make} ${v.model} ${v.plate} ${v.color ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => `${a.make}${a.model}`.localeCompare(`${b.make}${b.model}`));

  return (
    <>
      <PageHead title="Vozni park" sub={`${db.vehicles.filter((v) => !v.archived).length} vozila`} actions={<Link className="btn primary" to="/vozila/novo">+ Dodaj vozilo</Link>} />
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="search" placeholder="Pretraga (marka, model, tablice)" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Prikaži arhivirana</label>
      </div>
      {list.length === 0 ? (
        <div className="card empty">Nema vozila. <Link to="/vozila/novo">Dodajte prvo vozilo</Link>.</div>
      ) : (
        <div className="vehicle-grid">
          {list.map((v) => {
            const st = vehicleState(v, db.rentals);
            const cur = currentRental(db.rentals, v.id);
            const next = nextReservation(db.rentals, v.id);
            const reg = v.registrationExpiry ? daysUntil(v.registrationExpiry) : undefined;
            return (
              <Link key={v.id} to={`/vozila/${v.id}`} className="card vehicle-card">
                <div className="row">
                  <strong>{v.make} {v.model}</strong>
                  <span className="spacer" />
                  {st === 'dostupno' && <span className="badge good">Dostupno</span>}
                  {st === 'izdato' && cur && (isLate(cur) ? <span className="badge bad">Kasni povrat</span> : <span className="badge primary">Izdato</span>)}
                  {st === 'rezervisano_danas' && <span className="badge info">Preuzima se danas</span>}
                  {st === 'van_upotrebe' && <span className="badge warn">Van upotrebe</span>}
                </div>
                <div className="plate">{v.plate} · {v.year}{v.color ? ` · ${v.color}` : ''}</div>
                <div className="meta">
                  {categoryLabels[v.category]} · {fuelLabels[v.fuel]} · {transmissionLabels[v.transmission]} · {v.mileage.toLocaleString('sr-Latn-ME')} km
                </div>
                <div className="meta">
                  <strong style={{ color: 'var(--text)' }}>{money(v.dailyRate)}</strong>/dan
                  {reg !== undefined && (
                    <> · Reg. {reg < 0 ? <span className="money-neg">istekla</span> : reg <= db.settings.warnDays ? <span style={{ color: 'var(--warn)' }}>za {reg} d.</span> : `za ${reg} d.`}</>
                  )}
                </div>
                {cur && <div className="meta">Vraća se {fmtDateTime(cur.end)} · {cur.returnLocation}</div>}
                {!cur && next && <div className="meta">Sljedeća rez.: {fmtDateTime(next.start)}</div>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
