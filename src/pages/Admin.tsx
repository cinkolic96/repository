import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHead } from '../components/ui';
import {
  currentRental,
  expensesInPeriod,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  isLate,
  isoDateTime,
  rentalTotal,
  revenueInPeriod,
  toDate,
} from '../lib/calc';
import { loadAdminData, type AdminAgency, type AdminData } from '../lib/cloud';
import { rentalStatusLabels } from '../lib/labels';

interface AgencyStats {
  a: AdminAgency;
  owners: string[];
  members: number;
  vehicles: number;
  customers: number;
  rentals: number;
  active: number;
  late: number;
  monthRentals: number;
  monthRevenue: number;
  monthExpenses: number;
}

function monthRange(now = new Date()) {
  return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)] as const;
}

/** Zbir po valutama, npr. "1.200,00 € · 30.000 RSD" */
function sumByCurrency(items: { currency: string; value: number }[]): string {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.currency, (m.get(i.currency) ?? 0) + i.value);
  if (m.size === 0) return fmtMoney(0);
  return [...m.entries()].map(([c, v]) => fmtMoney(v, c)).join(' · ');
}

/** Serversko vrijeme (UTC) u lokalno, format YYYY-MM-DDTHH:mm */
const local = (iso: string) => isoDateTime(new Date(iso));

const ago = (iso: string | null) => {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'danas' : d === 1 ? 'juče' : `prije ${d} dana`;
};

export default function AdminPage({ onBack }: { onBack?: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'agencije' | 'korisnici'>('agencije');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadAdminData());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo<AgencyStats[]>(() => {
    if (!data) return [];
    const [from, to] = monthRange();
    return data.agencies
      .map((a) => {
        const members = data.users.filter((u) => u.memberships.some((m) => m.agencyId === a.id));
        const live = a.db.rentals.filter((r) => r.status !== 'otkazano');
        return {
          a,
          owners: members.filter((u) => u.memberships.some((m) => m.agencyId === a.id && m.role === 'owner')).map((u) => u.email),
          members: members.length,
          vehicles: a.db.vehicles.filter((v) => !v.archived).length,
          customers: a.db.customers.length,
          rentals: live.length,
          active: a.db.rentals.filter((r) => r.status === 'aktivno').length,
          late: a.db.rentals.filter((r) => isLate(r)).length,
          monthRentals: live.filter((r) => toDate(r.start) >= from && toDate(r.start) < to).length,
          monthRevenue: live.reduce((s, r) => s + revenueInPeriod(r, from, to), 0),
          monthExpenses: expensesInPeriod(a.db.expenses, from, to),
        };
      })
      .sort((x, y) => (y.a.lastActivity ?? y.a.createdAt).localeCompare(x.a.lastActivity ?? x.a.createdAt));
  }, [data]);

  if (error) {
    return (
      <>
        <PageHead title="Administracija" actions={onBack && <button className="btn" onClick={onBack}>← Nazad</button>} />
        <div className="notice bad">{/function .* does not exist|could not find the function/i.test(error)
          ? 'Administratorske funkcije nisu instalirane u bazi. Pokrenite SQL iz fajla supabase/migrations/0002_admin.sql.'
          : error}</div>
        <button className="btn" style={{ marginTop: 12 }} onClick={load}>Pokušaj ponovo</button>
      </>
    );
  }
  if (!data) return <div className="empty">Učitavam podatke svih agencija…</div>;

  const totalVehicles = stats.reduce((s, x) => s + x.vehicles, 0);
  const totalActive = stats.reduce((s, x) => s + x.active, 0);
  const totalMonthRentals = stats.reduce((s, x) => s + x.monthRentals, 0);
  const monthRevenue = sumByCurrency(stats.map((x) => ({ currency: x.a.db.settings.currency, value: x.monthRevenue })));
  const noAgency = data.users.filter((u) => u.memberships.length === 0).length;
  const agencyName = new Map(data.agencies.map((a) => [a.id, a.name]));
  const filtered = stats.filter((x) => `${x.a.name} ${x.owners.join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const users = data.users.filter((u) => u.email.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead
        title="Administracija"
        sub="Pregled svih agencija na platformi – samo za čitanje"
        actions={
          <>
            <button className="btn" onClick={load} disabled={loading}>{loading ? 'Osvježavam…' : 'Osvježi'}</button>
            {onBack && <button className="btn" onClick={onBack}>← Nazad</button>}
          </>
        }
      />
      <div className="stack">
        <div className="kpis">
          <div className="card kpi"><div className="label">Agencije</div><div className="value">{data.agencies.length}</div></div>
          <div className="card kpi"><div className="label">Korisnici</div><div className="value">{data.users.length}</div><div className="hint">{noAgency} bez agencije</div></div>
          <div className="card kpi"><div className="label">Vozila ukupno</div><div className="value">{totalVehicles}</div></div>
          <div className="card kpi"><div className="label">Trenutno izdato</div><div className="value">{totalActive}</div></div>
          <div className="card kpi"><div className="label">Najmova ovaj mjesec</div><div className="value">{totalMonthRentals}</div></div>
          <div className="card kpi"><div className="label">Prihod agencija ovaj mjesec</div><div className="value" style={{ fontSize: '1.2rem' }}>{monthRevenue}</div></div>
        </div>

        <div className="row">
          <div className="tabs" style={{ marginBottom: 0, flex: '1 1 260px' }}>
            <button className={tab === 'agencije' ? 'active' : ''} onClick={() => setTab('agencije')}>Agencije ({data.agencies.length})</button>
            <button className={tab === 'korisnici' ? 'active' : ''} onClick={() => setTab('korisnici')}>Korisnici ({data.users.length})</button>
          </div>
          <input className="search" style={{ flex: '1 1 200px' }} placeholder="Pretraga (naziv, email)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {tab === 'agencije' ? (
          <div className="card table-wrap">
            {filtered.length === 0 ? <div className="empty">Nema agencija.</div> : (
              <table>
                <thead>
                  <tr>
                    <th>Agencija</th>
                    <th>Vlasnik</th>
                    <th className="num">Članova</th>
                    <th className="num">Vozila</th>
                    <th className="num">Klijenata</th>
                    <th className="num">Izdato sad</th>
                    <th className="num">Najmova (mj.)</th>
                    <th className="num">Prihod (mj.)</th>
                    <th>Aktivnost</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((x) => (
                    <AgencyRows key={x.a.id} x={x} open={open === x.a.id} onToggle={() => setOpen(open === x.a.id ? null : x.a.id)} data={data} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="card table-wrap">
            <table>
              <thead>
                <tr><th>Email</th><th>Agencija i uloga</th><th>Registrovan</th><th>Posljednja prijava</th><th>Email potvrđen</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId}>
                    <td>{u.email}</td>
                    <td>
                      {u.memberships.length === 0 ? <span className="badge warn">bez agencije</span> : u.memberships.map((m) => (
                        <div key={m.agencyId}>{agencyName.get(m.agencyId) ?? '—'} <span className="muted small">({m.role === 'owner' ? 'vlasnik' : 'radnik'})</span></div>
                      ))}
                    </td>
                    <td>{fmtDate(local(u.createdAt))}</td>
                    <td>{u.lastSignInAt ? fmtDateTime(local(u.lastSignInAt)) : '—'}</td>
                    <td>{u.emailConfirmed ? <span className="badge good">da</span> : <span className="badge warn">ne</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function AgencyRows({ x, open, onToggle, data }: { x: AgencyStats; open: boolean; onToggle: () => void; data: AdminData }) {
  const { a } = x;
  const cur = a.db.settings.currency;
  const money = (n: number) => fmtMoney(n, cur);
  const members = data.users.filter((u) => u.memberships.some((m) => m.agencyId === a.id));
  const cById = new Map(a.db.customers.map((c) => [c.id, c]));
  const vById = new Map(a.db.vehicles.map((v) => [v.id, v]));
  const recent = [...a.db.rentals].sort((p, q) => q.start.localeCompare(p.start)).slice(0, 15);
  return (
    <>
      <tr className="clickable" onClick={onToggle}>
        <td><strong>{open ? '▾' : '▸'} {a.name}</strong><div className="muted small">od {fmtDate(local(a.createdAt))}</div></td>
        <td className="small">{x.owners.join(', ') || '—'}</td>
        <td className="num">{x.members}</td>
        <td className="num">{x.vehicles}</td>
        <td className="num">{x.customers}</td>
        <td className="num">{x.active}{x.late > 0 && <span className="badge bad" style={{ marginLeft: 6 }}>{x.late} kasni</span>}</td>
        <td className="num">{x.monthRentals}</td>
        <td className="num">{money(x.monthRevenue)}</td>
        <td className="small">{ago(a.lastActivity)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9} style={{ whiteSpace: 'normal', background: 'var(--surface-2)' }}>
            <div className="grid grid-3" style={{ padding: '8px 0' }}>
              <div className="card card-pad">
                <h3 style={{ marginBottom: 8 }}>Agencija</h3>
                <dl className="details">
                  <dt>Telefon</dt><dd>{a.db.settings.phone || '—'}</dd>
                  <dt>Email</dt><dd>{a.db.settings.email || '—'}</dd>
                  <dt>Adresa</dt><dd>{a.db.settings.address || '—'}</dd>
                  <dt>PIB</dt><dd>{a.db.settings.taxId || '—'}</dd>
                  <dt>Valuta</dt><dd>{cur}</dd>
                  <dt>Prihod (mj.)</dt><dd>{money(x.monthRevenue)}</dd>
                  <dt>Troškovi (mj.)</dt><dd>{money(x.monthExpenses)}</dd>
                  <dt>Najmova ukupno</dt><dd>{x.rentals}</dd>
                </dl>
              </div>
              <div className="card card-pad">
                <h3 style={{ marginBottom: 8 }}>Tim ({members.length})</h3>
                {members.map((u) => (
                  <div key={u.userId} className="small" style={{ marginBottom: 4 }}>
                    {u.email}{' '}
                    <span className="muted">
                      ({u.memberships.find((m) => m.agencyId === a.id)?.role === 'owner' ? 'vlasnik' : 'radnik'}, prijava {ago(u.lastSignInAt)})
                    </span>
                  </div>
                ))}
              </div>
              <div className="card card-pad">
                <h3 style={{ marginBottom: 8 }}>Vozila ({x.vehicles})</h3>
                {a.db.vehicles.filter((v) => !v.archived).map((v) => {
                  const r = currentRental(a.db.rentals, v.id);
                  return (
                    <div key={v.id} className="small" style={{ marginBottom: 4 }}>
                      {v.make} {v.model} <span className="mono muted">{v.plate}</span>{' '}
                      {v.outOfService ? <span className="badge warn">servis</span> : r ? <span className="badge primary">izdato</span> : <span className="badge good">slobodno</span>}
                    </div>
                  );
                })}
                {x.vehicles === 0 && <div className="muted small">Nema vozila.</div>}
              </div>
            </div>
            <div className="card table-wrap" style={{ marginBottom: 8 }}>
              {recent.length === 0 ? <div className="empty">Nema izdavanja.</div> : (
                <table>
                  <thead><tr><th>Broj</th><th>Status</th><th>Vozilo</th><th>Klijent</th><th>Period</th><th className="num">Iznos</th></tr></thead>
                  <tbody>
                    {recent.map((r) => {
                      const c = cById.get(r.customerId);
                      const v = vById.get(r.vehicleId);
                      return (
                        <tr key={r.id}>
                          <td className="mono">{r.number}</td>
                          <td>{isLate(r) ? 'Kasni povrat' : rentalStatusLabels[r.status]}</td>
                          <td>{v ? `${v.make} ${v.model}` : '—'}</td>
                          <td>{c ? `${c.firstName} ${c.lastName}` : '—'}</td>
                          <td>{fmtDateTime(r.start)} – {fmtDateTime(r.end)}</td>
                          <td className="num">{money(r.status === 'otkazano' ? 0 : rentalTotal(r))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
