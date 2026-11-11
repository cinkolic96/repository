import { Link, useNavigate, useParams } from 'react-router-dom';
import { Money, PageHead, StatusBadge } from '../components/ui';
import { fmtDate, fmtDateTime, isLate, rentalBalance, rentalTotal } from '../lib/calc';
import { deleteCustomer, useDB } from '../lib/store';

export default function CustomerDetail() {
  const { id } = useParams();
  const db = useDB();
  const nav = useNavigate();
  const c = db.customers.find((x) => x.id === id);
  if (!c) return <div className="empty">Klijent nije pronađen.</div>;
  const rentals = db.rentals.filter((r) => r.customerId === c.id).sort((a, b) => b.start.localeCompare(a.start));
  const vById = new Map(db.vehicles.map((v) => [v.id, v]));
  const active = rentals.filter((r) => r.status !== 'otkazano');

  return (
    <>
      <PageHead
        title={`${c.firstName} ${c.lastName}`}
        sub={c.blacklisted ? <span className="badge bad">Crna lista</span> : c.company}
        actions={
          <>
            <Link className="btn primary" to={`/izdavanja/novo?klijent=${c.id}`}>+ Rezervacija</Link>
            <Link className="btn" to={`/klijenti/${c.id}/uredi`}>Izmijeni</Link>
            <button className="btn danger" onClick={() => {
              if (!confirm('Obrisati klijenta?')) return;
              const err = deleteCustomer(c.id);
              if (err) alert(err); else nav('/klijenti');
            }}>Obriši</button>
          </>
        }
      />
      <div className="grid grid-2">
        <div className="card card-pad">
          <dl className="details">
            <dt>Telefon</dt><dd><a href={`tel:${c.phone}`}>{c.phone}</a></dd>
            <dt>Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</dd>
            <dt>{c.idDocumentType === 'pasos' ? 'Pasoš' : 'Lična karta'}</dt><dd>{c.idDocumentNumber || '—'}</dd>
            <dt>Vozačka dozvola</dt><dd>{c.licenseNumber || '—'} {c.licenseExpiry && <span className="muted">(važi do {fmtDate(c.licenseExpiry)})</span>}</dd>
            <dt>Datum rođenja</dt><dd>{fmtDate(c.birthDate)}</dd>
            <dt>Državljanstvo</dt><dd>{c.nationality || '—'}</dd>
            <dt>Adresa</dt><dd>{c.address || '—'}</dd>
            {c.notes && <><dt>Napomena</dt><dd>{c.notes}</dd></>}
          </dl>
        </div>
        <div className="kpis">
          <div className="card kpi"><div className="label">Broj najmova</div><div className="value">{active.length}</div></div>
          <div className="card kpi"><div className="label">Ukupno potrošio</div><div className="value"><Money value={active.reduce((s, r) => s + rentalTotal(r), 0)} /></div></div>
          <div className="card kpi"><div className="label">Duguje</div><div className="value"><Money value={active.reduce((s, r) => s + Math.max(0, rentalBalance(r)), 0)} /></div></div>
        </div>
      </div>
      <h2 style={{ margin: '20px 0 10px' }}>Istorija najmova</h2>
      <div className="card table-wrap">
        {rentals.length === 0 ? <div className="empty">Nema najmova.</div> : (
          <table>
            <thead><tr><th>Broj</th><th>Status</th><th>Vozilo</th><th>Period</th><th className="num">Ukupno</th></tr></thead>
            <tbody>
              {rentals.map((r) => {
                const v = vById.get(r.vehicleId);
                return (
                  <tr key={r.id} className="clickable" onClick={() => nav(`/izdavanja/${r.id}`)}>
                    <td className="mono">{r.number}</td>
                    <td><StatusBadge status={r.status} late={isLate(r)} /></td>
                    <td>{v ? `${v.make} ${v.model} (${v.plate})` : '—'}</td>
                    <td>{fmtDateTime(r.start)} – {fmtDateTime(r.end)}</td>
                    <td className="num"><Money value={rentalTotal(r)} /></td>
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
