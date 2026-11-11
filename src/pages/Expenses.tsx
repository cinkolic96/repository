import { useState } from 'react';
import ExpenseModal from '../components/ExpenseModal';
import { Money, PageHead } from '../components/ui';
import { fmtDate, round2 } from '../lib/calc';
import { expenseLabels } from '../lib/labels';
import { deleteExpense, useDB } from '../lib/store';
import type { Expense, ExpenseCategory } from '../lib/types';

export default function Expenses() {
  const db = useDB();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [cat, setCat] = useState<'' | ExpenseCategory>('');
  const [vehicle, setVehicle] = useState('');
  const [edit, setEdit] = useState<Expense | 'new' | null>(null);
  const vById = new Map(db.vehicles.map((v) => [v.id, v]));

  const list = db.expenses
    .filter((e) => !month || e.date.startsWith(month))
    .filter((e) => !cat || e.category === cat)
    .filter((e) => !vehicle || (vehicle === '__general' ? !e.vehicleId : e.vehicleId === vehicle))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = round2(list.reduce((s, e) => s + e.amount, 0));
  const byCat = Object.entries(
    list.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + e.amount }), {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHead title="Troškovi" sub="Registracije, osiguranja, servisi, kvarovi, gume, kazne i ostali rashodi" actions={<button className="btn primary" onClick={() => setEdit('new')}>+ Novi trošak</button>} />
      <div className="row" style={{ marginBottom: 12 }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 'auto' }} />
        <button className="btn small" onClick={() => setMonth('')}>Svi periodi</button>
        <select value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory | '')} style={{ width: 'auto' }}>
          <option value="">Sve kategorije</option>
          {Object.entries(expenseLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={vehicle} onChange={(e) => setVehicle(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Sva vozila</option>
          <option value="__general">Opšti troškovi agencije</option>
          {db.vehicles.map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.plate}</option>)}
        </select>
      </div>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">Ukupno</div><div className="value"><Money value={total} /></div><div className="hint">{list.length} stavki</div></div>
        {byCat.slice(0, 4).map(([k, sum]) => (
          <div className="card kpi" key={k}><div className="label">{expenseLabels[k as ExpenseCategory]}</div><div className="value"><Money value={sum} /></div></div>
        ))}
      </div>
      <div className="card table-wrap">
        {list.length === 0 ? <div className="empty">Nema troškova za izabrani filter.</div> : (
          <table>
            <thead><tr><th>Datum</th><th>Kategorija</th><th>Vozilo</th><th>Opis</th><th className="num">Iznos</th><th /></tr></thead>
            <tbody>
              {list.map((e) => {
                const v = e.vehicleId ? vById.get(e.vehicleId) : undefined;
                return (
                  <tr key={e.id} className="clickable" onClick={() => setEdit(e)}>
                    <td>{fmtDate(e.date)}</td>
                    <td>{expenseLabels[e.category]}</td>
                    <td>{v ? `${v.make} ${v.model} (${v.plate})` : <span className="muted">opšti</span>}</td>
                    <td>{e.description || '—'}{e.vendor && <div className="muted small">{e.vendor}</div>}</td>
                    <td className="num"><Money value={e.amount} /></td>
                    <td className="num">
                      <button className="btn small danger" onClick={(ev) => { ev.stopPropagation(); if (confirm('Obrisati trošak?')) deleteExpense(e.id); }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {edit && <ExpenseModal initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}
