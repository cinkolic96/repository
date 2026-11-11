import { useRef, useState } from 'react';
import { Field, PageHead, num } from '../components/ui';
import { isoDate } from '../lib/calc';
import { demoDB } from '../lib/demo';
import { exportJSON, importJSON, localDeviceData, markLocalMigrated, mergeDB, replaceDB, resetDB, saveSettings, useDB } from '../lib/store';
import { withUuids } from '../lib/cloud';
import { useSession } from '../lib/session';
import Team from '../components/Team';
import SyncBadge from '../components/SyncBadge';
import type { Settings } from '../lib/types';

export default function SettingsPage() {
  const db = useDB();
  const [s, setS] = useState<Settings>(db.settings);
  const [newLoc, setNewLoc] = useState('');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const session = useSession();
  const cloud = session.mode === 'cloud';
  const local = cloud ? localDeviceData() : null;

  if (session.role !== 'owner') {
    return (
      <>
        <PageHead title="Podešavanja" />
        <div className="card card-pad stack">
          <h2>Nalog</h2>
          <SyncBadge />
          <div>{session.email} · <span className="muted">Radnik u agenciji „{db.settings.agencyName}“</span></div>
          <p className="small muted" style={{ margin: 0 }}>Podešavanja agencije može mijenjati samo vlasnik.</p>
          <div className="row">
            {session.signOut && <button className="btn" onClick={session.signOut}>Odjavi se</button>}
          </div>
        </div>
      </>
    );
  }

  const up = (p: Partial<Settings>) => { setS((x) => ({ ...x, ...p })); setSaved(false); };

  const backup = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rentmanager-backup-${isoDate()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <PageHead title="Podešavanja" />
      <div className="stack">
        <div className="card card-pad">
          <div className="form">
            <div className="section-title">Agencija (prikazuje se na ugovoru)</div>
            <Field label="Naziv agencije"><input value={s.agencyName} onChange={(e) => up({ agencyName: e.target.value })} /></Field>
            <Field label="Adresa"><input value={s.address ?? ''} onChange={(e) => up({ address: e.target.value })} /></Field>
            <Field label="Telefon"><input value={s.phone ?? ''} onChange={(e) => up({ phone: e.target.value })} /></Field>
            <Field label="Email"><input value={s.email ?? ''} onChange={(e) => up({ email: e.target.value })} /></Field>
            <Field label="PIB"><input value={s.taxId ?? ''} onChange={(e) => up({ taxId: e.target.value })} /></Field>
            <Field label="Valuta">
              <select value={s.currency} onChange={(e) => up({ currency: e.target.value })}>
                <option value="EUR">EUR (€)</option>
                <option value="RSD">RSD (din)</option>
                <option value="BAM">BAM (KM)</option>
                <option value="HRK">HRK</option>
                <option value="MKD">MKD (den)</option>
                <option value="USD">USD ($)</option>
              </select>
            </Field>
            <Field label="Upozorenje za isteke (dana unaprijed)"><input inputMode="numeric" value={s.warnDays} onChange={(e) => up({ warnDays: num(e.target.value) })} /></Field>

            <div className="section-title">Lokacije preuzimanja i povrata</div>
            <div className="full">
              <div className="row" style={{ marginBottom: 8 }}>
                {s.locations.map((l) => (
                  <span key={l} className="badge neutral">
                    {l}
                    <button className="btn small" style={{ padding: '0 4px', border: 'none', background: 'none' }} onClick={() => up({ locations: s.locations.filter((x) => x !== l) })} aria-label={`Ukloni ${l}`}>✕</button>
                  </span>
                ))}
              </div>
              <div className="row" style={{ flexWrap: 'nowrap', maxWidth: 420 }}>
                <input value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="npr. Aerodrom Tivat" />
                <button className="btn" onClick={() => { if (newLoc.trim() && !s.locations.includes(newLoc.trim())) up({ locations: [...s.locations, newLoc.trim()] }); setNewLoc(''); }}>Dodaj</button>
              </div>
            </div>

            <Field label="Uslovi najma (štampaju se na ugovoru)" full>
              <textarea style={{ minHeight: 160 }} value={s.contractTerms} onChange={(e) => up({ contractTerms: e.target.value })} />
            </Field>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={() => { saveSettings(s); setSaved(true); }}>Sačuvaj podešavanja</button>
            {saved && <span className="badge good">Sačuvano ✓</span>}
          </div>
        </div>

        {cloud && <Team />}

        <div className="card card-pad stack">
          <h2>Podaci i rezervna kopija</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {cloud
              ? 'Podaci se čuvaju na serveru i dostupni su na svim uređajima vašeg tima. Rezervnu kopiju možete i preuzeti.'
              : 'Podaci se trenutno čuvaju samo na ovom uređaju. Redovno pravite rezervnu kopiju.'} ({db.vehicles.length} vozila, {db.customers.length} klijenata, {db.rentals.length} izdavanja, {db.expenses.length} troškova)
          </p>
          <div className="row">
            <button className="btn" onClick={backup}>Preuzmi rezervnu kopiju (JSON)</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>Vrati iz kopije…</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (!confirm('Ovo će zamijeniti sve trenutne podatke. Nastaviti?')) return;
              try { importJSON(await f.text(), cloud ? withUuids : undefined); setS(JSON.parse(exportJSON()).settings); alert('Podaci vraćeni.'); } catch { alert('Neispravan fajl.'); }
              e.target.value = '';
            }} />
          </div>
          {local && (
            <div className="notice info">
              Na ovom uređaju postoje podaci iz vremena prije prijave ({local.vehicles.length} vozila, {local.rentals.length} izdavanja).{' '}
              <button className="btn small" onClick={() => {
                if (!confirm('Dodati podatke sa ovog uređaja na server agencije?')) return;
                mergeDB(withUuids(local));
                markLocalMigrated();
                setS({ ...s });
                alert('Podaci su dodati.');
              }}>Prenesi na server</button>
            </div>
          )}
          <div className="row">
            <button className="btn" onClick={() => confirm('Zamijeniti sve podatke demo podacima?' + (cloud ? ' Ovo važi za cijeli tim!' : '')) && replaceDB({ ...demoDB(), settings: db.settings })}>Učitaj demo podatke</button>
            <button className="btn danger" onClick={() => confirm('Obrisati SVA vozila, klijente, izdavanja i troškove?' + (cloud ? ' Brišu se na serveru za cijeli tim!' : '') + ' Ovo se ne može poništiti.') && resetDB()}>Obriši sve podatke</button>
          </div>
        </div>
      </div>
    </>
  );
}
