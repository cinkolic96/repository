import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../components/ui';

export default function More({ links }: { links: { to: string; label: string; icon: ReactNode }[] }) {
  return (
    <>
      <PageHead title="Više" />
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
    </>
  );
}
