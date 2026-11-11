// E2E test rada sa serverom (dva korisnika, realtime, offline).
// Preduslov: lokalni Supabase (npx supabase start), build sa .env.local i 'npx vite preview --port 4173'.
// Upotreba: node scripts/e2e-cloud.cjs <folder-za-screenshotove>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
const URL = 'http://localhost:4173/';
const log = (...a) => console.log('•', ...a);
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    p.on('dialog', (d) => d.accept());
    return { ctx, p };
  };
  const owner = await mk('owner');
  const p = owner.p;
  // 1) lokalni podaci prije prijave (demo) – da testiramo prenos
  await p.goto(URL);
  await p.waitForSelector('text=Prijava');
  await p.screenshot({ path: out + '/c-login.png' });
  await p.evaluate(() => {
    // simuliraj stare lokalne podatke sa ne-UUID id-jevima
    const db = { version: 1, vehicles: [{ id: 'old-v1', make: 'Fiat', model: 'Panda', plate: 'PG OLD1', year: 2019, category: 'mali', fuel: 'benzin', transmission: 'manuelni', seats: 4, mileage: 90000, dailyRate: 20, deposit: 100, outOfService: false, createdAt: '2026-01-01T10:00' }],
      customers: [{ id: 'old-c1', firstName: 'Stari', lastName: 'Klijent', phone: '069', idDocumentType: 'pasos', idDocumentNumber: 'X', licenseNumber: 'Y', blacklisted: false, createdAt: '2026-01-01T10:00' }],
      rentals: [{ id: 'old-r1', number: '2026-0001', vehicleId: 'old-v1', customerId: 'old-c1', start: '2026-11-01T10:00', end: '2026-11-04T10:00', pickupLocation: 'Poslovnica', returnLocation: 'Poslovnica', dailyRate: 20, extras: [], discount: 0, deliveryFee: 0, deposit: 100, depositReturned: true, payments: [], status: 'zavrseno', extraCharges: 0, createdAt: '2026-11-01T10:00' }],
      expenses: [], settings: {} };
    localStorage.setItem('rentacar-db-v1', JSON.stringify(db));
  });
  // 2) registracija vlasnika
  await p.click('text=Registrujte se');
  await p.fill('input[type=email]', 'vlasnik@test.me');
  await p.fill('input[type=password]', 'tajna123');
  await p.click('button:has-text("Napravi nalog")');
  await p.waitForSelector('text=Vlasnik ste agencije?');
  await p.screenshot({ path: out + '/c-onboarding.png' });
  await p.fill('input[placeholder^="npr. Rent"]', 'Test Rent Budva');
  await p.click('button:has-text("Kreiraj agenciju")');
  await p.waitForSelector('h1:has-text("Pregled")');
  await p.waitForSelector('text=Sačuvano na serveru');
  log('vlasnik ušao, badge:', await p.locator('.sidebar .badge').first().textContent());
  log('vozila nakon prenosa:', await p.locator('text=Fiat Panda').count() > 0);
  // 3) poziv radniku
  await p.goto(URL + '#/podesavanja');
  await p.fill('input[placeholder="email radnika"]', 'Radnik@Test.me');
  await p.click('button:has-text("Pozovi")');
  await p.waitForSelector('text=čeka registraciju');
  await p.screenshot({ path: out + '/c-team.png', fullPage: true });
  log('pozivnica kreirana; ponuda za ponovni prenos (0):', await p.locator('text=Prenesi na server').count());

  // 4) radnik se registruje u drugom pregledaču
  const staff = await mk('staff');
  const s = staff.p;
  await s.goto(URL);
  await s.click('text=Registrujte se');
  await s.fill('input[type=email]', 'radnik@test.me');
  await s.fill('input[type=password]', 'tajna456');
  await s.click('button:has-text("Napravi nalog")');
  await s.waitForSelector('h1:has-text("Pregled")');
  log('radnik ušao direktno (pozivnica prihvaćena):', true);
  log('radnik vidi Izvještaje u meniju:', await s.locator('.sidebar a:has-text("Izvještaji")').count());
  log('radnik vidi Prihod KPI:', await s.locator('text=Prihod ovaj mjesec').count());
  log('radnik vidi Fiat:', await s.locator('text=Fiat Panda').count() > 0);
  await s.screenshot({ path: out + '/c-staff-home.png' });

  // 5) radnik dodaje vozilo -> vlasnik vidi bez osvježavanja
  await p.goto(URL + '#/vozila');
  await s.goto(URL + '#/vozila/novo');
  await s.fill('input[placeholder="npr. Volkswagen"]', 'Tesla');
  await s.fill('input[placeholder="npr. Golf 8"]', 'Model 3');
  await s.fill('input[placeholder="PG AB123"]', 'BD EV001');
  await s.click('button:has-text("Sačuvaj")');
  await s.waitForSelector('h1:has-text("Tesla Model 3")');
  await p.waitForSelector('text=Tesla Model 3', { timeout: 15000 });
  log('REALTIME: vlasnik vidi novo vozilo radnika bez osvježavanja');

  // 6) vlasnik briše trošak / radnik vidi brisanje: dodaj trošak pa obriši
  await p.goto(URL + '#/troskovi');
  await p.click('button:has-text("Novi trošak")');
  await p.fill('.modal input[inputmode="decimal"]', '77');
  await p.fill('.modal textarea', 'Pranje za test');
  await p.click('.modal button:has-text("Sačuvaj")');
  await s.goto(URL + '#/vozila');
  await s.waitForTimeout(500);
  const hasExp = await s.evaluate(() => 1);
  await p.waitForSelector('text=Sačuvano na serveru');
  // radnik otvara troškove
  await s.goto(URL + '#/troskovi');
  await s.waitForSelector('text=Pranje za test', { timeout: 15000 });
  await p.click('tr:has-text("Pranje za test") button.danger');
  await s.waitForSelector('text=Pranje za test', { state: 'detached', timeout: 15000 });
  log('REALTIME: brisanje vidljivo kod radnika');

  // 7) offline režim kod radnika
  await staff.ctx.setOffline(true);
  await s.click('button:has-text("Novi trošak")');
  await s.fill('.modal input[inputmode="decimal"]', '15');
  await s.fill('.modal textarea', 'Offline trošak');
  await s.click('.modal button:has-text("Sačuvaj")');
  await s.waitForSelector('.badge:has-text("Bez interneta")', { timeout: 15000 });
  log('offline badge:', await s.locator('.badge:has-text("Bez interneta")').first().textContent());
  await s.screenshot({ path: out + '/c-offline.png' });
  await staff.ctx.setOffline(false);
  await s.evaluate(() => window.dispatchEvent(new Event('online')));
  await s.waitForSelector('text=Sačuvano na serveru', { timeout: 20000 });
  await p.waitForSelector('text=Offline trošak', { timeout: 15000 });
  log('offline promjena poslata kad se vratio internet i stigla vlasniku');

  // 8) podešavanja: vlasnik mijenja naziv -> radnik vidi
  await p.goto(URL + '#/podesavanja');
  const nameInput = p.locator('label:has-text("Naziv agencije") input');
  await nameInput.fill('Test Rent Budva & Kotor');
  await p.click('button:has-text("Sačuvaj podešavanja")');
  await s.goto(URL + '#/podesavanja');
  await s.waitForSelector('text=Test Rent Budva & Kotor', { timeout: 15000 });
  log('podešavanja sinhronizovana');

  // 9) reload vlasnika – podaci sa servera
  await p.reload();
  await p.goto(URL + '#/vozila');
  await p.waitForSelector('text=Tesla Model 3');
  log('nakon osvježavanja podaci ostaju');
  // 10) odjava
  await p.goto(URL + '#/');
  await p.click('.sidebar button:has-text("Odjavi se")');
  await p.waitForSelector('text=Prijava');
  log('odjava ok');
  await s.screenshot({ path: out + '/c-staff-settings.png' });
  console.log('errors:', errs);
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
