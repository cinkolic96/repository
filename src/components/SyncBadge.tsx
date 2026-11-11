import { retrySync, useSyncStatus } from '../lib/cloud';
import { useSession } from '../lib/session';

/** Prikazuje da li su promjene sačuvane na serveru. */
export default function SyncBadge() {
  const session = useSession();
  const s = useSyncStatus();
  if (session.mode === 'local') {
    return <span className="badge neutral" title="Podaci se čuvaju samo na ovom uređaju">● Samo na ovom uređaju</span>;
  }
  if (s.state === 'saving') return <span className="badge info">● Čuvam… ({s.pending})</span>;
  if (s.state === 'offline' || (session.offline && s.state === 'idle' && !navigator.onLine)) {
    return (
      <button className="badge warn" style={{ border: 0, cursor: 'pointer' }} onClick={retrySync} title="Promjene će se poslati kad se vrati internet">
        ● Bez interneta{s.pending ? ` – ${s.pending} na čekanju` : ''}
      </button>
    );
  }
  if (s.state === 'error') {
    return (
      <button className="badge bad" style={{ border: 0, cursor: 'pointer' }} onClick={retrySync} title={s.error}>
        ● Greška pri čuvanju – pokušaj ponovo
      </button>
    );
  }
  return <span className="badge good">● Sačuvano na serveru</span>;
}
