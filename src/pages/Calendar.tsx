import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHead } from '../components/ui';
import { addDays, fmtDateTime, isLate, isoDateTime, sameDay, toDate } from '../lib/calc';
import { useDB } from '../lib/store';

const COL = 40;
const NAME = 170;
const DAY_MS = 86400000;
const DOW = ['Ne', 'Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su'];

export default function CalendarPage() {
  const db = useDB();
  const nav = useNavigate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [from, setFrom] = useState(() => addDays(today, -3));
  const [days, setDays] = useState(window.innerWidth < 700 ? 14 : 31);
  const to = addDays(from, days);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const vehicles = db.vehicles.filter((v) => !v.archived);
  const cById = new Map(db.customers.map((c) => [c.id, c]));

  const cols = `${NAME}px repeat(${days}, ${COL}px)`;

  return (
    <>
      <PageHead
        title="Kalendar zauzetosti"
        sub="Kliknite na prazno polje da napravite rezervaciju za to vozilo i dan."
        actions={
          <>
            <button className="btn" onClick={() => setFrom(addDays(from, -7))}>←</button>
            <button className="btn" onClick={() => setFrom(addDays(today, -3))}>Danas</button>
            <button className="btn" onClick={() => setFrom(addDays(from, 7))}>→</button>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 'auto' }}>
              <option value={14}>14 dana</option>
              <option value={31}>31 dan</option>
              <option value={60}>60 dana</option>
            </select>
          </>
        }
      />
      <div className="legend" style={{ marginBottom: 12 }}>
        <span><i style={{ background: '#6250d6' }} />Rezervisano</span>
        <span><i style={{ background: '#1f7a45' }} />Izdato</span>
        <span><i style={{ background: '#c0302f' }} />Kasni povrat</span>
        <span><i style={{ background: '#8a8f99' }} />Završeno</span>
      </div>
      <div className="card timeline">
        <div className="tl-grid" style={{ gridTemplateColumns: cols }}>
          <div className="tl-name tl-head" style={{ zIndex: 3 }}>Vozilo</div>
          {dates.map((d) => {
            const we = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div key={d.toISOString()} className={'tl-cell tl-head' + (sameDay(d, today) ? ' today' : '') + (we ? ' weekend' : '')}>
                {DOW[d.getDay()]}
                <br />
                <strong>{d.getDate()}.{d.getMonth() + 1}</strong>
              </div>
            );
          })}
        </div>
        {vehicles.length === 0 && <div className="empty">Nema vozila. <Link to="/vozila/novo">Dodajte vozilo</Link>.</div>}
        {vehicles.map((v) => {
          const rs = db.rentals.filter(
            (r) => r.vehicleId === v.id && r.status !== 'otkazano' && toDate(r.start) < to && toDate(r.end) > from,
          );
          return (
            <div key={v.id} className="tl-row">
              <div className="tl-grid" style={{ gridTemplateColumns: cols }}>
                <div className="tl-name">
                  <Link to={`/vozila/${v.id}`} style={{ color: 'inherit' }}>{v.make} {v.model}</Link>
                  <small>{v.plate}{v.outOfService ? ' · servis' : ''}</small>
                </div>
                {dates.map((d) => (
                  <div
                    key={d.toISOString()}
                    className="tl-cell"
                    style={{ cursor: 'copy', background: v.outOfService ? 'var(--warn-soft)' : undefined }}
                    title="Nova rezervacija"
                    onClick={() => {
                      const s = new Date(d);
                      s.setHours(10, 0, 0, 0);
                      nav(`/izdavanja/novo?vozilo=${v.id}&od=${encodeURIComponent(isoDateTime(s))}`);
                    }}
                  />
                ))}
              </div>
              {rs.map((r) => {
                const s = Math.max(toDate(r.start).getTime(), from.getTime());
                const e = Math.min(toDate(r.end).getTime(), to.getTime());
                const left = NAME + ((s - from.getTime()) / DAY_MS) * COL;
                const width = Math.max(8, ((e - s) / DAY_MS) * COL);
                const c = cById.get(r.customerId);
                const late = isLate(r);
                return (
                  <div
                    key={r.id}
                    className={'tl-bar ' + (late ? 'late' : r.status)}
                    style={{ left, width }}
                    title={`${r.number} · ${c ? c.firstName + ' ' + c.lastName : ''}\n${fmtDateTime(r.start)} ${r.pickupLocation}\n→ ${fmtDateTime(r.end)} ${r.returnLocation}`}
                    onClick={() => nav(`/izdavanja/${r.id}`)}
                  >
                    {c ? `${c.firstName} ${c.lastName}` : r.number}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
