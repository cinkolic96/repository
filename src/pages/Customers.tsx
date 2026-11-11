import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Money, PageHead } from '../components/ui';
import { rentalBalance, rentalTotal } from '../lib/calc';
import { useDB } from '../lib/store';

export default function Customers() {
  const db = useDB();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const list = db.customers
    .filter((c) => `${c.firstName} ${c.lastName} ${c.phone} ${c.email ?? ''} ${c.idDocumentNumber} ${c.company ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  return (
    <>
      <PageHead title="Klijenti" sub={`${db.customers.length} ukupno`} actions={<Link className="btn primary" to="/klijenti/novo">+ Novi klijent</Link>} />
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="search" placeholder="Pretraga (ime, telefon, dokument…)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card table-wrap">
        {list.length === 0 ? <div className="empty">Nema klijenata.</div> : (
          <table>
            <thead>
              <tr><th>Ime i prezime</th><th>Telefon</th><th>Državljanstvo</th><th className="num">Najmova</th><th className="num">Potrošio</th><th className="num">Duguje</th></tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const rs = db.rentals.filter((r) => r.customerId === c.id && r.status !== 'otkazano');
                const spent = rs.reduce((s, r) => s + rentalTotal(r), 0);
                const debt = rs.reduce((s, r) => s + Math.max(0, rentalBalance(r)), 0);
                return (
                  <tr key={c.id} className="clickable" onClick={() => nav(`/klijenti/${c.id}`)}>
                    <td>
                      {c.firstName} {c.lastName} {c.blacklisted && <span className="badge bad">Crna lista</span>}
                      {c.company && <div className="muted small">{c.company}</div>}
                    </td>
                    <td>{c.phone}</td>
                    <td>{c.nationality || '—'}</td>
                    <td className="num">{rs.length}</td>
                    <td className="num"><Money value={spent} /></td>
                    <td className="num">{debt > 0 ? <span className="money-neg"><Money value={debt} /></span> : '—'}</td>
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
