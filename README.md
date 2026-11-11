# RentManager – aplikacija za vlasnike rent-a-car agencija

Web aplikacija (radi i na telefonu, može se "instalirati" kao PWA) za vođenje voznog parka,
rezervacija, izdavanja, klijenata, prihoda i troškova. Podaci se čuvaju na serveru (Supabase),
sa prijavom korisnika i više zaposlenih po agenciji, ili – bez servera – lokalno na uređaju. Pripremljena je da se kasnije
upakuje u aplikacije za **App Store** i **Google Play** (Capacitor).

## Šta aplikacija radi

| Modul | Funkcije |
|---|---|
| **Pregled** | Broj vozila, izdato / dostupno / van upotrebe, prihod, troškovi i dobit za tekući mjesec, nenaplaćeni dug, današnja i sutrašnja preuzimanja i povraćaji, status svakog vozila, upozorenja |
| **Kalendar** | Vremenska linija zauzetosti svih vozila po danima (rezervisano / izdato / kasni / završeno); klik na prazno polje pravi rezervaciju |
| **Izdavanja** | Rezervacija → izdavanje → povrat. Datum i vrijeme preuzimanja i povrata, mjesto preuzimanja i mjesto povrata, cijena po danu, dodaci (dječije sjedište, GPS, dodatni vozač, puno osiguranje, zeleni karton…), dostava, popust, depozit, uplate (više uplata, način plaćanja), km i gorivo pri izdavanju/povratu, oštećenja, dodatne naplate, automatski obračun po stvarnom vremenu povrata, **štampa ugovora**, zaštita od dvostrukog izdavanja istog vozila |
| **Vozila** | Marka, model, tablice, VIN, godište, boja, kategorija, gorivo, mjenjač, kilometraža, cijena/depozit, istek registracije, osiguranja, kaska i tehničkog, sljedeći servis, nabavna cijena; istorija izdavanja i troškova, ukupna dobit i iskorišćenost po vozilu; van upotrebe / arhiva |
| **Klijenti** | Lični podaci, dokument, vozačka dozvola (i njen istek), državljanstvo, firma, istorija najmova, potrošeno i dug, **crna lista** |
| **Troškovi** | Registracija, osiguranje, servis, kvar, gume, gorivo, pranje, kazne, lizing, plate, zakup, marketing… po vozilu ili opšti troškovi agencije |
| **Izvještaji** | Prihodi vs troškovi po mjesecima (grafikon + tabela), isplativost i iskorišćenost po vozilu, troškovi po kategoriji, izvoz u CSV (Excel) |
| **Podešavanja** | Podaci agencije za ugovor, valuta, lokacije, uslovi najma, rezervna kopija (izvoz/uvoz), demo podaci |
| **Nalozi i tim** | Registracija / prijava / zaboravljena lozinka, kreiranje agencije, pozivanje zaposlenih po emailu, uloge **Vlasnik** i **Radnik** (radnik ne vidi izvještaje ni finansijske preglede), više agencija po nalogu |
| **Sinhronizacija** | Promjene se odmah vide na svim uređajima (realtime); rad bez interneta – promjene čekaju i šalju se kad se veza vrati; prenos postojećih lokalnih podataka na server |

Automatska upozorenja: istekla / skoro istekla registracija, osiguranje, kasko i tehnički,
servis po kilometraži, kašnjenje sa povratom, nepreuzete rezervacije, nenaplaćeni iznosi,
nevraćen depozit.

## Povezivanje sa serverom (Supabase)

1. Napravite besplatan nalog i projekat na [supabase.com](https://supabase.com) (region npr. Frankfurt).
2. U projektu otvorite **SQL Editor**, nalijepite sadržaj fajla
   `supabase/migrations/0001_init.sql` i kliknite **Run**.
3. **Authentication → URL Configuration**: u *Site URL* upišite adresu na kojoj će aplikacija
   biti objavljena, a u *Redirect URLs* dodajte i `http://localhost:5173` (za razvoj).
4. **Project Settings → API**: kopirajte *Project URL* i *anon public* ključ u fajl `.env.local`
   (primjer je u `.env.example`).
5. `npm run dev` – aplikacija sada traži prijavu. Prvi korisnik kreira agenciju i postaje vlasnik;
   radnike poziva u **Podešavanja → Tim** (radnik se zatim registruje sa tim emailom).

Bez `.env.local` aplikacija radi kao ranije – samo lokalno na uređaju.

**Sigurnost:** svaka tabela ima Row Level Security – korisnik vidi i mijenja samo podatke
agencije čiji je član; pozivnice i članove vidi/mijenja samo vlasnik. Ograničenje da radnik
ne vidi izvještaje je u interfejsu aplikacije (podatke o najmovima radnik i inače mora vidjeti).

## Pokretanje

```bash
npm install
npm run dev        # razvoj – http://localhost:5173
npm test           # testovi obračuna
scripts/test-db.sh # testovi sigurnosnih pravila baze na lokalnom Postgresu
npx supabase start # kompletan lokalni Supabase (Docker), za razvoj i e2e test
npm run build      # produkcijski build u dist/
```

Na prvom pokretanju kliknite **"Učitaj demo podatke"** da vidite aplikaciju sa primjerima.

## Tehnologija

- React 18 + TypeScript + Vite, bez teških UI biblioteka
- `src/lib/types.ts` – model podataka
- `src/lib/calc.ts` – sva poslovna logika (obračun dana i cijene, preklapanja, upozorenja, izvještaji) – pokrivena testovima
- `src/lib/store.ts` – stanje aplikacije; lokalno ili sinhronizovano sa serverom
- `src/lib/cloud.ts` – Supabase: učitavanje, red čekanja za slanje (radi i offline), realtime, tim
- `src/AuthGate.tsx` – prijava, izbor/kreiranje agencije
- `supabase/migrations/` – šema baze i sigurnosna pravila

## Sljedeći koraci (plan)

1. ~~Server i nalozi~~ ✓
2. **Fotografije** – slike vozila, skenirani dokumenti klijenta, fotografije oštećenja pri izdavanju i povratu.
3. **Mobilne aplikacije** (Capacitor je već konfigurisan u `capacitor.config.json`):
   ```bash
   npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
   npm run build
   npx cap add android && npx cap add ios
   npx cap sync
   npx cap open android   # Android Studio → Google Play
   npx cap open ios       # Xcode (macOS) → App Store
   ```
   Potrebni su Apple Developer nalog (99 USD/god.) i Google Play Console nalog (25 USD jednokratno).
4. Push obavještenja (povrat za 1h, ističe registracija), SMS/email potvrde klijentu,
   online rezervacije sa sajta agencije, sezonske cijene i popusti za duži najam,
   PDF fakture, više poslovnica.
