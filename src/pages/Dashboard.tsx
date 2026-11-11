import { Link, useNavigate } from 'react-router-dom';
import { PageHead, StatusBadge, useMoney } from '../components/ui';
import {
  addDays,
  buildAlerts,
  currentRental,
  expensesInPeriod,
  fmtDateTime,
  isLate,
  nextReservation,
  rentalBalance,
  revenueInPeriod,
  sameDay,
  toDate,
  vehicleState,
} from '../lib/calc';
import { demoDB } from '../lib/demo';
import { replaceDB, useDB } from '../lib/store';

export default function Dashboard() {
  const db = useDB();
  const money = useMoney();
  const nav = useNavigate();
  const now = new Date();
  const vehicles = db.vehicles.filter((v) => !v.archived);

  if (vehicles.length === 0 && db.rentals.length === 0) {
    return (
      <>
        <PageHead title="Dobrodošli u RentManager" />
        <div className="card card-pad stack">
          <p>Počnite dodavanjem vozila iz vašeg voznog parka, ili učitajte demo podatke da isprobate aplikaciju.</p>
          <div className="row">
            <Link className="btn primary" to="/vozila/novo">+ Dodaj prvo vozilo</Link>
            <button className="btn" onClick={() => replaceDB(demoDB())}>Učitaj demo podatke</button>
          </div>
        </div>
      </>
    );
  }

  const states = vehicles.map((v) => vehicleState(v, db.rentals, now));
  const rented = states.filter((s) => s === 'izdato').length;
  const outOfService = states.filter((s) => s === 'van_upotrebe').length;
  const available = vehicles.length - rented - outOfService;

  const mFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const mTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const revenue = db.rentals.filter((r) => r.status !== 'otkazano').reduce((s, r) => s + revenueInPeriod(r, mFrom, mTo), 0);
  const expenses = expensesInPeriod(db.expenses, mFrom, mTo);
  const unpaid = db.rentals
    .filter((r) => r.status !== 'otkazano')
    .reduce((s, r) => s + Math.max(0, rentalBalance(r)), 0);

  const vById = new Map(db.vehicles.map((v) => [v.id, v]));
  const cById = new Map(db.customers.map((c) => [c.id, c]));
  const tomorrowEnd = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 2);

  const pickups = db.rentals
    .filter((r) => r.status === 'rezervisano' && toDate(r.start) < tomorrowEnd)
    .sort((a, b) => a.start.localeCompare(b.start));
  const returns = db.rentals
    .filter((r) => r.status === 'aktivno' && toDate(r.end) < tomorrowEnd)
    .sort((a, b) => a.end.localeCompare(b.end));
  const alerts = buildAlerts(db, now);
  const dayLabel = (s: string) => (sameDay(toDate(s), now) ? 'Danas' : toDate(s) < now ? 'Kasni' : 'Sutra');

  const rentalRow = (r: (typeof db.rentals)[number], when: string) => {
    const v = vById.get(r.vehicleId);
    const c = cById.get(r.customerId);
    return (
      <tr key={r.id} className="clickable" onClick={() => nav(`/izdavanja/${r.id}`)}>
        <td>
          <strong>{dayLabel(when)}</strong> <span className="muted">{fmtDateTime(when).slice(-5)}</span>
        </td>
        <td>{v ? `${v.make} ${v.model}` : '—'}<div className="muted small mono">{v?.plate}</div></td>
        <td>{c ? `${c.firstName} ${c.lastName}` : '—'}<div className="muted small">{c?.phone}</div></td>
        <td>{when === r.start ? r.pickupLocation : r.returnLocation}</td>
      </tr>
    );
  };

  return (
    <>
      <PageHead
        title="Pregled"
        sub={now.toLocaleDateString('sr-Latn-ME', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={<Link className="btn primary" to="/izdavanja/novo">+ Nova rezervacija</Link>}
      />
      <div className="stack">
        <div className="kpis">
          <div className="card kpi"><div className="label">Vozila ukupno</div><div className="value">{vehicles.length}</div><div className="hint">{outOfService} van upotrebe</div></div>
          <div className="card kpi"><div className="label">Trenutno izdato</div><div className="value">{rented}</div><div className="hint">{vehicles.length ? Math.round((rented / vehicles.length) * 100) : 0}% voznog parka</div></div>
          <div className="card kpi"><div className="label">Dostupno</div><div className="value">{available}</div></div>
          <div className="card kpi"><div className="label">Prihod ovaj mjesec</div><div className="value">{money(revenue)}</div></div>
          <div className="card kpi"><div className="label">Troškovi ovaj mjesec</div><div className="value">{money(expenses)}</div></div>
          <div className="card kpi"><div className="label">Dobit ovaj mjesec</div><div className={'value ' + (revenue - expenses < 0 ? 'money-neg' : '')}>{money(revenue - expenses)}</div></div>
          <div className="card kpi"><div className="label">Nenaplaćeno</div><div className="value">{money(unpaid)}</div><div className="hint">otvoreni dug klijenata</div></div>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-head"><h2>Preuzimanja (danas i sutra)</h2><span className="badge primary">{pickups.length}</span></div>
            {pickups.length ? (
              <div className="table-wrap"><table><tbody>{pickups.map((r) => rentalRow(r, r.start))}</tbody></table></div>
            ) : <div className="empty">Nema zakazanih preuzimanja.</div>}
          </div>
          <div className="card">
            <div className="card-head"><h2>Povraćaji (danas i sutra)</h2><span className="badge primary">{returns.length}</span></div>
            {returns.length ? (
              <div className="table-wrap"><table><tbody>{returns.map((r) => rentalRow(r, r.end))}</tbody></table></div>
            ) : <div className="empty">Nema zakazanih povraćaja.</div>}
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-head"><h2>Upozorenja</h2><span className={'badge ' + (alerts.some((a) => a.level === 'critical') ? 'bad' : 'neutral')}>{alerts.length}</span></div>
            {alerts.length ? (
              <ul className="alert-list">
                {alerts.slice(0, 12).map((a, i) => (
                  <li key={i}>
                    <span className={'badge ' + (a.level === 'critical' ? 'bad' : a.level === 'warning' ? 'warn' : 'info')}>
                      {a.level === 'critical' ? '! Hitno' : a.level === 'warning' ? 'Pažnja' : 'Info'}
                    </span>
                    {a.link ? <Link to={a.link}>{a.text}</Link> : a.text}
                  </li>
                ))}
              </ul>
            ) : <div className="empty">Sve je u redu ✓</div>}
          </div>
          <div className="card">
            <div className="card-head"><h2>Status vozila</h2><Link to="/kalendar" className="small">Kalendar →</Link></div>
            <div className="table-wrap">
              <table>
                <tbody>
                  {vehicles.map((v, i) => {
                    const st = states[i];
                    const cur = currentRental(db.rentals, v.id);
                    const next = nextReservation(db.rentals, v.id, now);
                    return (
                      <tr key={v.id} className="clickable" onClick={() => nav(`/vozila/${v.id}`)}>
                        <td>{v.make} {v.model}<div className="muted small mono">{v.plate}</div></td>
                        <td>
                          {st === 'izdato' && cur ? <StatusBadge status="aktivno" late={isLate(cur, now)} /> : null}
                          {st === 'dostupno' && <span className="badge good">Dostupno</span>}
                          {st === 'rezervisano_danas' && <span className="badge info">Preuzima se danas</span>}
                          {st === 'van_upotrebe' && <span className="badge warn">Van upotrebe</span>}
                        </td>
                        <td className="small muted">
                          {cur ? `do ${fmtDateTime(cur.end)} · ${cur.returnLocation}` : next ? `sljedeća: ${fmtDateTime(next.start)}` : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
