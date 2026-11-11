import { useState } from 'react';
import { Link } from 'react-router-dom';
import MonthChart from '../components/MonthChart';
import { Money, PageHead } from '../components/ui';
import { monthlyReport, round2, vehicleReport } from '../lib/calc';
import { expenseLabels } from '../lib/labels';
import { useDB } from '../lib/store';
import type { ExpenseCategory } from '../lib/types';

function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Reports() {
  const db = useDB();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [vehicleId, setVehicleId] = useState('');
  const rows = monthlyReport(db, year, vehicleId || undefined);
  const totals = rows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, expenses: a.expenses + r.expenses }), { revenue: 0, expenses: 0 });
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const perVehicle = vehicleReport(db, from, to);
  const years = Array.from(new Set([thisYear, ...db.rentals.map((r) => Number(r.start.slice(0, 4))), ...db.expenses.map((e) => Number(e.date.slice(0, 4)))])).sort((a, b) => b - a);

  const expByCat = Object.entries(
    db.expenses
      .filter((e) => e.date.startsWith(String(year)) && (!vehicleId || e.vehicleId === vehicleId))
      .reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + e.amount }), {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHead
        title="Izvještaji"
        sub="Prihodi se raspoređuju po danima najma u mjesecu u kojem je vozilo bilo izdato."
        actions={
          <>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 'auto' }}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Sva vozila</option>
              {db.vehicles.map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.plate}</option>)}
            </select>
          </>
        }
      />
      <div className="stack">
        <div className="kpis">
          <div className="card kpi"><div className="label">Prihodi {year}</div><div className="value"><Money value={totals.revenue} /></div></div>
          <div className="card kpi"><div className="label">Troškovi {year}</div><div className="value"><Money value={totals.expenses} /></div></div>
          <div className="card kpi"><div className="label">Dobit {year}</div><div className="value"><Money value={round2(totals.revenue - totals.expenses)} colored /></div></div>
        </div>

        <div className="card card-pad">
          <h2 style={{ marginBottom: 8 }}>Po mjesecima</h2>
          <MonthChart rows={rows} />
          <details style={{ marginTop: 12 }}>
            <summary className="small">Prikaži tabelu</summary>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Mjesec</th><th className="num">Prihodi</th><th className="num">Troškovi</th><th className="num">Dobit</th><th className="num">Dana u najmu</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td className="num"><Money value={r.revenue} /></td>
                      <td className="num"><Money value={r.expenses} /></td>
                      <td className="num"><Money value={r.profit} colored /></td>
                      <td className="num">{Math.round(r.rentedDays)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-head">
              <h2>Isplativost po vozilu ({year})</h2>
              <button className="btn small" onClick={() => downloadCSV(`vozila-${year}.csv`, [
                ['Vozilo', 'Tablice', 'Najmova', 'Dana', 'Iskorišćenost %', 'Prihod', 'Troškovi', 'Dobit'],
                ...perVehicle.map((p) => [`${p.vehicle.make} ${p.vehicle.model}`, p.vehicle.plate, p.rentals, p.rentedDays, Math.round(p.utilization * 100), p.revenue, p.expenses, p.profit]),
              ])}>CSV</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Vozilo</th><th className="num">Najmova</th><th>Iskorišćenost</th><th className="num">Prihod</th><th className="num">Troškovi</th><th className="num">Dobit</th></tr></thead>
                <tbody>
                  {perVehicle.map((p) => (
                    <tr key={p.vehicle.id}>
                      <td><Link to={`/vozila/${p.vehicle.id}`}>{p.vehicle.make} {p.vehicle.model}</Link><div className="muted small mono">{p.vehicle.plate}</div></td>
                      <td className="num">{p.rentals}</td>
                      <td><div className="row" style={{ flexWrap: 'nowrap' }}><div className="progress" style={{ flex: 1 }}><div style={{ width: `${p.utilization * 100}%` }} /></div><span className="small">{Math.round(p.utilization * 100)}%</span></div></td>
                      <td className="num"><Money value={p.revenue} /></td>
                      <td className="num"><Money value={p.expenses} /></td>
                      <td className="num"><Money value={p.profit} colored /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Troškovi po kategoriji ({year})</h2>
              <button className="btn small" onClick={() => downloadCSV(`mjesecno-${year}.csv`, [
                ['Mjesec', 'Prihodi', 'Troškovi', 'Dobit'],
                ...rows.map((r) => [r.label, r.revenue, r.expenses, r.profit]),
              ])}>CSV po mjesecima</button>
            </div>
            {expByCat.length === 0 ? <div className="empty">Nema troškova.</div> : (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {expByCat.map(([k, sum]) => (
                      <tr key={k}>
                        <td>{expenseLabels[k as ExpenseCategory]}</td>
                        <td style={{ width: '45%' }}><div className="progress"><div style={{ width: `${(sum / expByCat[0][1]) * 100}%`, background: 'var(--series-2)' }} /></div></td>
                        <td className="num"><Money value={sum} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
