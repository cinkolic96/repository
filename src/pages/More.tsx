import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import SyncBadge from '../components/SyncBadge';
import { PageHead } from '../components/ui';
import { useSession } from '../lib/session';

export default function More({ links }: { links: { to: string; label: string; icon: ReactNode }[] }) {
  const session = useSession();
  return (
    <>
      <PageHead title="Više" />
      <div className="stack">
        <div className="card">
          <ul className="alert-list">
            {links.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="row" style={{ width: '100%', color: 'inherit' }}>
                  <span style={{ width: 22, display: 'inline-flex' }}>{l.icon}</span>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="card card-pad stack">
          <SyncBadge />
          {session.email && (
            <div className="small">
              {session.email} · <span className="muted">{session.role === 'owner' ? 'Vlasnik' : 'Radnik'}</span>
            </div>
          )}
          <div className="row">
            {session.switchAgency && <button className="btn" onClick={session.switchAgency}>Promijeni agenciju</button>}
            {session.signOut && <button className="btn" onClick={session.signOut}>Odjavi se</button>}
          </div>
        </div>
      </div>
    </>
  );
}
