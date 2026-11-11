import { useState, type ReactNode } from 'react';
import { Field } from '../components/ui';
import { supabase } from '../lib/supabase';

function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="card card-pad auth-card">
        <div className="brand" style={{ padding: '0 0 16px' }}>
          <img src="icon.svg" alt="" />
          <div>
            RentManager
            <small>upravljanje rent-a-car agencijom</small>
          </div>
        </div>
        <h1 style={{ marginBottom: 16 }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

const translate = (msg: string) => {
  if (/invalid login credentials/i.test(msg)) return 'Pogrešan email ili lozinka.';
  if (/email not confirmed/i.test(msg)) return 'Email još nije potvrđen – otvorite link koji smo vam poslali.';
  if (/already registered/i.test(msg)) return 'Nalog sa ovim emailom već postoji – prijavite se.';
  if (/at least 6/i.test(msg) || /password should be/i.test(msg)) return 'Lozinka mora imati najmanje 6 karaktera.';
  if (/rate limit/i.test(msg)) return 'Previše pokušaja – sačekajte malo pa pokušajte ponovo.';
  if (/failed to fetch/i.test(msg)) return 'Nema veze sa serverom. Provjerite internet.';
  return msg;
};

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) setInfo('Poslali smo vam email za potvrdu. Otvorite link iz emaila, pa se prijavite.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        setInfo('Ako nalog postoji, poslali smo vam link za novu lozinku.');
      }
    } catch (err) {
      setError(translate((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? 'Prijava' : mode === 'register' ? 'Novi nalog' : 'Zaboravljena lozinka';
  return (
    <AuthCard title={title}>
      <form onSubmit={submit} className="stack">
        <Field label="Email">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        {mode !== 'reset' && (
          <Field label="Lozinka" help={mode === 'register' ? 'Najmanje 6 karaktera' : undefined}>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </Field>
        )}
        {error && <div className="notice bad">{error}</div>}
        {info && <div className="notice info">{info}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Sačekajte…' : mode === 'login' ? 'Prijavi se' : mode === 'register' ? 'Napravi nalog' : 'Pošalji link'}
        </button>
      </form>
      <div className="stack small" style={{ marginTop: 16, textAlign: 'center' }}>
        {mode === 'login' ? (
          <>
            <div>Nemate nalog? <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); }}>Registrujte se</a></div>
            <div><a href="#" onClick={(e) => { e.preventDefault(); setMode('reset'); }}>Zaboravili ste lozinku?</a></div>
          </>
        ) : (
          <div><a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }}>← Nazad na prijavu</a></div>
        )}
        <div className="muted">Radnici: registrujte se sa emailom na koji vas je vlasnik pozvao.</div>
      </div>
    </AuthCard>
  );
}

export function NewPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return (
    <AuthCard title="Nova lozinka">
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase!.auth.updateUser({ password });
          if (error) setError(translate(error.message));
          else onDone();
        }}
      >
        <Field label="Nova lozinka"><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></Field>
        {error && <div className="notice bad">{error}</div>}
        <button className="btn primary" type="submit">Sačuvaj lozinku</button>
      </form>
    </AuthCard>
  );
}

export function OnboardingPage({
  email,
  localSummary,
  onCreate,
  onRefresh,
  onSignOut,
}: {
  email: string;
  localSummary: string | null;
  onCreate: (name: string, importLocal: boolean) => Promise<void>;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const [name, setName] = useState('');
  const [importLocal, setImportLocal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <AuthCard title="Dobrodošli!">
      <p className="small muted" style={{ marginTop: 0 }}>Prijavljeni ste kao <strong>{email}</strong>.</p>
      <div className="stack">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await onCreate(name.trim(), importLocal && !!localSummary);
            } catch (err) {
              setError(translate((err as Error).message));
              setBusy(false);
            }
          }}
        >
          <h2>Vlasnik ste agencije?</h2>
          <Field label="Naziv agencije"><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="npr. Rent-a-car Montenegro" /></Field>
          {localSummary && (
            <label className="check">
              <input type="checkbox" checked={importLocal} onChange={(e) => setImportLocal(e.target.checked)} />
              Prenesi podatke sa ovog uređaja ({localSummary})
            </label>
          )}
          {error && <div className="notice bad">{error}</div>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Kreiram…' : 'Kreiraj agenciju'}</button>
        </form>
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', width: '100%' }} />
        <div className="stack">
          <h2>Radnik ste?</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Zamolite vlasnika da vas pozove (Podešavanja → Tim) sa emailom <strong>{email}</strong>, pa kliknite „Provjeri ponovo“.
          </p>
          <div className="row">
            <button className="btn" onClick={onRefresh}>Provjeri ponovo</button>
            <button className="btn" onClick={onSignOut}>Odjavi se</button>
          </div>
        </div>
      </div>
    </AuthCard>
  );
}

export function AgencyPicker({ agencies, onPick, onSignOut }: { agencies: { agencyId: string; agencyName: string; role: string }[]; onPick: (id: string) => void; onSignOut: () => void }) {
  return (
    <AuthCard title="Izaberite agenciju">
      <div className="stack">
        {agencies.map((a) => (
          <button key={a.agencyId} className="btn" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => onPick(a.agencyId)}>
            {a.agencyName}
            <span className="badge neutral">{a.role === 'owner' ? 'vlasnik' : 'radnik'}</span>
          </button>
        ))}
        <button className="btn" onClick={onSignOut}>Odjavi se</button>
      </div>
    </AuthCard>
  );
}

export function Loading({ text = 'Učitavanje…' }: { text?: string }) {
  return (
    <div className="auth-wrap">
      <div className="muted">{text}</div>
    </div>
  );
}

export function ErrorScreen({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut?: () => void }) {
  return (
    <AuthCard title="Greška">
      <div className="notice bad">{translate(message)}</div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary" onClick={onRetry}>Pokušaj ponovo</button>
        {onSignOut && <button className="btn" onClick={onSignOut}>Odjavi se</button>}
      </div>
    </AuthCard>
  );
}
