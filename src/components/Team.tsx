import { useCallback, useEffect, useState } from 'react';
import { createInvite, deleteInvite, listInvites, listMembers, removeMember, setMemberRole, type Invite, type Member, type Role } from '../lib/cloud';
import { useSession } from '../lib/session';

const roleLabel: Record<Role, string> = { owner: 'Vlasnik', staff: 'Radnik' };

export default function Team() {
  const { agencyId, userId } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = useCallback(async () => {
    if (!agencyId) return;
    try {
      const [m, i] = await Promise.all([listMembers(agencyId), listInvites(agencyId)]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setError('');
    setInfo('');
    try {
      await fn();
      if (ok) setInfo(ok);
      await load();
    } catch (e) {
      const msg = (e as Error).message;
      setError(/duplicate|unique/i.test(msg) ? 'Ova osoba je već pozvana.' : msg);
    }
  };

  if (!agencyId) return null;
  return (
    <div className="card card-pad stack">
      <h2>Tim</h2>
      <p className="small muted" style={{ margin: 0 }}>
        <strong>Vlasnik</strong> vidi sve, uključujući finansije, izvještaje i podešavanja. <strong>Radnik</strong> radi sa
        vozilima, klijentima, rezervacijama i troškovima, ali ne vidi izvještaje i finansijske preglede.
      </p>
      <div className="table-wrap">
        <table>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <td>{m.email ?? '—'} {m.userId === userId && <span className="badge neutral">vi</span>}</td>
                <td>
                  <select
                    value={m.role}
                    style={{ width: 'auto' }}
                    onChange={(e) => run(() => setMemberRole(agencyId, m.userId, e.target.value as Role))}
                    disabled={m.userId === userId}
                  >
                    <option value="owner">Vlasnik</option>
                    <option value="staff">Radnik</option>
                  </select>
                </td>
                <td className="num">
                  {m.userId !== userId && (
                    <button className="btn small danger" onClick={() => confirm(`Ukloniti ${m.email ?? 'člana'} iz agencije?`) && run(() => removeMember(agencyId, m.userId))}>
                      Ukloni
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {invites.map((i) => (
              <tr key={i.id}>
                <td>{i.email} <span className="badge warn">čeka registraciju</span></td>
                <td>{roleLabel[i.role]}</td>
                <td className="num"><button className="btn small danger" onClick={() => run(() => deleteInvite(i.id))}>Otkaži</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          void run(async () => {
            await createInvite(agencyId, email, role);
            setEmail('');
          }, `Pozivnica sačuvana. Recite osobi da se registruje u aplikaciji sa emailom ${email.trim().toLowerCase()} – automatski će dobiti pristup.`);
        }}
      >
        <input type="email" placeholder="email radnika" value={email} onChange={(e) => setEmail(e.target.value)} style={{ maxWidth: 280 }} required />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={{ width: 'auto' }}>
          <option value="staff">Radnik</option>
          <option value="owner">Vlasnik</option>
        </select>
        <button className="btn primary" type="submit">Pozovi</button>
      </form>
      {info && <div className="notice info">{info}</div>}
      {error && <div className="notice bad">{error}</div>}
    </div>
  );
}
