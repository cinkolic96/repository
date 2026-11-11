// E2E test administratorskog pregleda (pokrenuti poslije scripts/e2e-cloud.cjs, uz lokalni Supabase).
const { chromium } = require('playwright');
const URL = 'http://localhost:4173/';
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const login = async (email, pw, vp = { width: 1366, height: 900 }) => {
    const p = await (await b.newContext({ viewport: vp, timezoneId: 'Europe/Podgorica' })).newPage();
    p.on('pageerror', e => errs.push(email + ': ' + e.message));
    await p.goto(URL); await p.waitForSelector('text=Prijava');
    await p.fill('input[type=email]', email); await p.fill('input[type=password]', pw);
    await p.click('button:has-text("Prijavi se")');
    return p;
  };
  const a = await login('vlasnik@test.me', 'tajna123');
  await a.waitForSelector('.sidebar a:has-text("Administracija")');
  await a.click('.sidebar a:has-text("Administracija")');
  await a.waitForSelector('text=Pregled svih agencija');
  console.log('• KPI:', (await a.locator('.kpi').allInnerTexts()).map(t => t.replace(/\n/g, ' ')).join(' | '));
  await a.click('tbody tr.clickable >> nth=0');
  await a.waitForSelector('text=Tim (');
  await a.screenshot({ path: process.argv[2] + '/admin-agency.png', fullPage: true });
  await a.click('button:has-text("Korisnici (")');
  console.log('• korisnici:', (await a.locator('tbody tr').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')).join(' || '));
  await a.screenshot({ path: process.argv[2] + '/admin-users.png', fullPage: true });

  const s = await login('radnik@test.me', 'tajna456');
  await s.waitForSelector('h1:has-text("Pregled")');
  console.log('• radnik vidi link Administracija:', await s.locator('a:has-text("Administracija")').count());
  await s.goto(URL + '#/admin'); await s.waitForTimeout(800);
  console.log('• radnik otvara #/admin direktno ->', (await s.locator('main').innerText()).slice(0, 40).replace(/\n/g, ' '));

  // admin bez agencije
  const n = await (await b.newContext()).newPage();
  n.on('pageerror', e => errs.push('novi: ' + e.message));
  await n.goto(URL); await n.waitForSelector('text=Prijava');
  await n.click('text=Registrujte se');
  await n.fill('input[type=email]', 'admin2@test.me'); await n.fill('input[type=password]', 'tajna789');
  await n.click('button:has-text("Napravi nalog")');
  await n.waitForSelector('text=Vlasnik ste agencije?');
  console.log('• novi korisnik (nije admin) vidi dugme administracije:', await n.locator('text=Administracija platforme').count());
  require('child_process').execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -q -c "insert into public.platform_admins (user_id) select id from auth.users where email='admin2@test.me'"`);
  await n.click('button:has-text("Provjeri ponovo")');
  await n.waitForSelector('text=Administracija platforme');
  await n.click('text=Administracija platforme');
  await n.waitForSelector('text=Pregled svih agencija');
  console.log('• admin bez agencije otvorio pregled, agencija u tabeli:', await n.locator('tbody tr.clickable').count());
  // mobilni prikaz
  const m = await login('vlasnik@test.me', 'tajna123', { width: 390, height: 844 });
  await m.waitForSelector('h1:has-text("Pregled")');
  await m.goto(URL + '#/vise');
  console.log('• mobilni Više sadrži Administraciju:', await m.locator('main a:has-text("Administracija")').count());
  await m.goto(URL + '#/admin'); await m.waitForSelector('text=Pregled svih agencija');
  await m.screenshot({ path: process.argv[2] + '/admin-mob.png', fullPage: true });
  console.log('errors:', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
