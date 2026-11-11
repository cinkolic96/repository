import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import { acceptInvites, closeAgency, createAgency, myMemberships, openAgency, withUuids, type Membership } from './lib/cloud';
import { SessionContext, type SessionInfo } from './lib/session';
import { getDB, localDeviceData, markLocalMigrated, mergeDB, saveSettings } from './lib/store';
import { cloudEnabled, supabase } from './lib/supabase';
import { AgencyPicker, ErrorScreen, Loading, LoginPage, NewPasswordPage, OnboardingPage } from './pages/Auth';

const LAST_AGENCY = 'rentacar-last-agency';

function lastAgency(): Membership | null {
  try {
    const m = JSON.parse(localStorage.getItem(LAST_AGENCY) ?? 'null');
    return m && typeof m.agencyId === 'string' ? m : null;
  } catch {
    return null;
  }
}

function localSummary(): string | null {
  const db = localDeviceData();
  if (!db) return null;
  return `${db.vehicles.length} vozila, ${db.customers.length} klijenata, ${db.rentals.length} izdavanja, ${db.expenses.length} troškova`;
}

type Phase =
  | { k: 'loading'; text?: string }
  | { k: 'signedOut' }
  | { k: 'recovery' }
  | { k: 'onboarding' }
  | { k: 'pick'; list: Membership[] }
  | { k: 'ready'; m: Membership; offline: boolean; multiple: boolean }
  | { k: 'error'; message: string };

export default function AuthGate() {
  if (!cloudEnabled) {
    // Server nije podešen – sve radi lokalno na uređaju
    return (
      <SessionContext.Provider value={{ mode: 'local', role: 'owner' }}>
        <App />
      </SessionContext.Provider>
    );
  }
  return <CloudGate />;
}

function CloudGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const recovery = useRef(false);

  useEffect(() => {
    const sb = supabase!;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        recovery.current = true;
        setPhase({ k: 'recovery' });
      }
      setSession((prev) => (prev?.user.id === s?.user.id && prev?.access_token === s?.access_token ? prev : s));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await closeAgency();
    await supabase!.auth.signOut();
  }, []);

  const enter = useCallback(async (m: Membership, multiple: boolean) => {
    setPhase({ k: 'loading', text: `Učitavam ${m.agencyName}…` });
    try {
      const { offline } = await openAgency(m.agencyId);
      localStorage.setItem(LAST_AGENCY, JSON.stringify(m));
      setPhase({ k: 'ready', m, offline, multiple });
    } catch (e) {
      setPhase({ k: 'error', message: (e as Error).message });
    }
  }, []);

  const resolve = useCallback(async (userId: string) => {
    setPhase({ k: 'loading' });
    try {
      await acceptInvites();
      const list = await myMemberships(userId);
      if (list.length === 0) return setPhase({ k: 'onboarding' });
      const last = list.find((m) => m.agencyId === lastAgency()?.agencyId);
      if (last || list.length === 1) return enter(last ?? list[0], list.length > 1);
      setPhase({ k: 'pick', list });
    } catch (e) {
      // Bez interneta: otvori posljednju agenciju iz keša
      const last = lastAgency();
      if (last && !navigator.onLine) return enter(last, false);
      setPhase({ k: 'error', message: (e as Error).message });
    }
  }, [enter]);

  const userId = session?.user.id;
  useEffect(() => {
    if (session === undefined || recovery.current) return;
    if (!userId) setPhase({ k: 'signedOut' });
    else void resolve(userId);
  }, [userId, session === undefined, resolve]);

  if (phase.k === 'recovery') {
    return (
      <NewPasswordPage
        onDone={() => {
          recovery.current = false;
          if (userId) void resolve(userId);
          else setPhase({ k: 'signedOut' });
        }}
      />
    );
  }
  if (session === undefined || phase.k === 'loading') return <Loading text={phase.k === 'loading' ? phase.text : undefined} />;
  if (!session || phase.k === 'signedOut') return <LoginPage />;
  if (phase.k === 'error') return <ErrorScreen message={phase.message} onRetry={() => resolve(session.user.id)} onSignOut={signOut} />;
  if (phase.k === 'pick') return <AgencyPicker agencies={phase.list} onPick={(id) => enter(phase.list.find((m) => m.agencyId === id)!, true)} onSignOut={signOut} />;
  if (phase.k === 'onboarding') {
    return (
      <OnboardingPage
        email={session.user.email ?? ''}
        localSummary={localSummary()}
        onRefresh={() => resolve(session.user.id)}
        onSignOut={signOut}
        onCreate={async (name, importLocal) => {
          const agencyId = await createAgency(name);
          const m: Membership = { agencyId, agencyName: name, role: 'owner' };
          await enter(m, false);
          const local = importLocal ? localDeviceData() : null;
          if (local) {
            mergeDB(withUuids(local));
            saveSettings({ ...local.settings, agencyName: name });
            markLocalMigrated();
          } else {
            saveSettings({ ...getDB().settings, agencyName: name });
          }
        }}
      />
    );
  }

  const info: SessionInfo = {
    mode: 'cloud',
    email: session.user.email,
    userId: session.user.id,
    agencyId: phase.m.agencyId,
    role: phase.m.role,
    offline: phase.offline,
    signOut,
    switchAgency: phase.multiple
      ? async () => {
          await closeAgency();
          localStorage.removeItem(LAST_AGENCY);
          void resolve(session.user.id);
        }
      : undefined,
  };
  return (
    <SessionContext.Provider value={info}>
      <App />
    </SessionContext.Provider>
  );
}
