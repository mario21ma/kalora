# Kalora — preostali potvrđeni popravci, 15. listopada 2026.

Grana: `codex/beta-confirmed-fixes-2026-10-15`. Polazište: `7aead637ea4ed8d910537438ec90ef734eaa1e37` (`main`, UI 6.2).

Ovaj dokument opisuje posljednji skup popravaka. Raniji `BETA_FIXES.md` opisuje prethodnu isporuku i njezine tadašnje rezultate. Nisu dodane nove funkcionalnosti, promijenjena shema dnevnika ni objavljene izmjene. Postojeća radna kopija u drugom direktoriju ostala je sačuvana.

## Što je popravljeno

| Potvrđeni problem | Promjena i dokaz |
|---|---|
| Brisanje računa uz pun localStorage i staru sesiju bez identiteta | `lib/cloud.ts` prvo uklanja sirovu sesiju; čišćenje vlastitog dnevnika i svih ključeva njegovih kopija ide kroz `finally`. `lib/diary-storage.ts` pamti potvrđeno brisanje prije pokušaja trajnog zapisa i zaustavlja već pokrenute lokalne pisce. Nakon oslobađanja vlastitog prostora ponavlja se mali trajni marker. Drugi račun, gost i nepovezani podaci ne brišu se radi oslobađanja prostora. `tests/session.test.mjs` pokriva ograničen kapacitet, a `tests/browser-regressions.mjs` stvarnu Chromium kvotu bez zamjene Storage API-ja. |
| Zakašnjeli zahtjev stare kartice vraća PWA na V1 | `public/sw.js` koristi cache v6, redni broj zahtjeva dodijeljen prije dohvata, serijalizirano objavljivanje i ponovnu provjeru redoslijeda nakon asinkronih koraka. Jedan otvoreni cache po workeru odvaja stariji worker od novoga. `tests/pwa-deploy.test.mjs` koristi stvarne service workere/CacheStorage, dvije kartice, zadržani V1 asset i HTML te nadogradnju dok stari worker ima zahtjev u tijeku. Regresija zakašnjelog asseta pada na izvornom workeru iz `7aead637`. |
| Zastarjeli profil nakon uvoza/zamjene i gubitak nespremljenog teksta | `components/profile.tsx` i novi `lib/profile-draft.ts` usklađuju svako polje s prethodno spremljenom vrijednošću, korisnikovim nacrtom i novim profilom. Čista polja prate zamjenu; neovisne izmjene ostaju. Sukob istog polja čuva nacrt i traži izbor prije spremanja. Potvrda vlastitog spremanja čuva tekst upisan nakon slanja. Regresije: `tests/profile-draft.test.mjs` i četiri preglednička scenarija uvoza na već otvorenom obrascu. |
| Parser količina | `lib/domain.ts`: „150 g grčkog jogurta 2%” daje 150 g, „pola litre mlijeka” 500 ml, „dvjesto g banana” 200 g. Postotak i broj unutar naziva nisu dodatna količina. Nepodržana ili nejasna izričita količina vraća se u `unknown` za postojeću poruku pojašnjenja; nema tihog prihvaćanja zadane porcije ni nagađanja gustoće pri g/ml. `tests/domain.test.mjs` uključuje zadane primjere, složene brojeve, frakcije, postotke, neispravne i proturječne količine. |
| Oporavak nakon prvog 503/offline neuspjeha | `lib/diary-store.ts` dopušta ponovnu provjeru oblaka uz korumpiran lokalni zapis bez dopuštanja automatskog prepisivanja. Fokus/online koriste postojeći sync put; „Učitaj oblak” u `app/page.tsx` dopušta izričit ponovni pokušaj čim je uređaj online. Provjere se udružuju i poštuju vlasnika/generaciju. Zakašnjeli početni dohvat ne može prepisati već oporavljen dnevnik i kasnije unose. Regresije: `tests/diary-store.test.mjs` i preglednički 503 → oporavak bez osvježavanja. |
| Fatalna greška skenera | `lib/barcode-scanner.ts` prosljeđuje fatalnu grešku postojećem prikazu i zaustavlja taj pokušaj; postojeći „Skeniraj ponovno” ponovno pokreće kameru. Stvarne ZXing NotFound/Checksum/Format greške pojedinog kadra nastavljaju skeniranje. `tests/scanner.test.mjs` izvršava instaliranu ZXing petlju uz simulirane medijske ulaze i provjerava fatalnu grešku → ponovni pokušaj, prekid, zakašnjele callbackove i sva tri očekivana tipa greške. Preglednik provjerava stvarni učitani bundle i ponavljanje nakon odbijene kamere. |
| /privacy nema poveznicu na /terms | Dodana je poveznica u `app/privacy/page.tsx`. Postojeća preglednička provjera pravnih poveznica obuhvaća registraciju, profil i privatnost. |
| Uređivanje 0,5 g i 1,25 g | `app/page.tsx` koristi kontrolirani vidljivi tekst i zajednički validator količine, umjesto neusklađenog `min=1`/`step=.1`. Prazno, nula, nebroj, negativno i >5000 blokiraju spremanje. Dvije pregledničke regresije provjeravaju i promjenu obroka bez promjene tih količina. |
| Undo uz duple datume težine | `lib/undo.ts` više ne odbija običnu radnju nad hranom/profilom zbog duplikata u nepovezanoj zbirci. Svi takvi zapisi ostaju sačuvani. Stvarno nejednoznačne izmjene zbirke s istim ključevima i dalje se sigurno odbijaju umjesto gubitka podataka. Regresije u `tests/undo.test.mjs`. |
| Undo vraća zastarjelu oznaku procjene | Kada se mijenja količina, `grams` i `isEstimate` poništavaju se zajedno samo ako oba još odgovaraju poništavanoj radnji. Novija količina/oznaka i nepovezane izmjene ostaju. Regresije za 120 procjena → 240 izričito → 360 izričito, kasniju promjenu oznake i samostalnu izmjenu metapodatka u `tests/undo.test.mjs`. |

## Lokalna provjera

Node.js 22.23.3, pnpm 11.25.0, sistemski Chromium. Instalacija je koristila postojeći lockfile (`pnpm install --frozen-lockfile`), bez promjene ovisnosti.

| Provjera | Rezultat |
|---|---|
| `pnpm test` | 198/198, bez preskakanja |
| `pnpm test:database` | 7/7, bez preskakanja |
| `pnpm typecheck` | Prošlo |
| `pnpm build` | Prošlo; Next.js produkcijski build |
| `pnpm test:browser` | 36/36, bez preskakanja; 28 UI + 8 PWA provjera |
| `git diff --check` | Prošlo |

SQL testovi izvršavaju stvarne repozitorijske skripte u odvojenim lokalnim PGlite bazama: RLS/uloge, revizije i rollback, voda, trajne AI kvote i brisanje računa. UI regresije rade na lokalnom produkcijskom buildu, s izričito simuliranim računima i Supabase/AI odgovorima; neočekivani vanjski zahtjevi prekidaju se i ruše test. PWA testovi koriste lokalnu V1/V2 HTTP simulaciju uz stvarni Chromium i CacheStorage. To nije produkcijska provjera Supabasea, Vercela, AI modela ili fizičke kamere.

Dodatna provjera stvarnog konačnog Next.js builda i service workera prošla je offline otvaranje `/privacy` i `/terms` te povratak u aplikaciju, bez JavaScript grešaka. Neovisni pregled konačne profilne i Undo logike nije pronašao novu potvrđenu grešku. Prvi preglednički prolaz imao je dvije pogrešne nove testne pretpostavke da stari gram zapisi moraju sadržavati `unit: 'g'`; konačni testovi provjeravaju stvarnu jedinicu i očuvanje obiju postojećih reprezentacija. Završni puni prolaz ima 36/36 uspješnih testova.

Ponovljivi koraci nakon instalacije:

```bash
pnpm test
pnpm test:database
pnpm typecheck
pnpm build
pnpm start --port 3003
# U drugom terminalu, nakon pokretanja lokalnog servera:
KALORA_BROWSER_URL=http://127.0.0.1:3003 pnpm test:browser
```

Ako Playwright Chromium nije instaliran, koristi instalirani kompatibilni Chromium kroz `PLAYWRIGHT_CHROMIUM_EXECUTABLE` ili instaliraj preglednik uobičajenim Playwright postupkom. Build i TypeScript provjere pokretati redom.

## SQL i odvojeni Preview

**Za ovaj skup izmjena nema nove SQL migracije.** Postojeće skripte nisu mijenjane niti su izvršene na produkciji. Prethodno prikazani rezultati korisnikovih SQL upita potvrđuju prisutnost traženih tablica/RPC-a i uključene cleanup triggere; ne zamjenjuju funkcionalnu provjeru stvarnog projekta.

Ako još nisu primijenjene na nekoj testnoj bazi, relevantne su postojeće `supabase/water_entries_migration.sql`, `supabase/ai_rate_limit_migration.sql` i `supabase/ai_quota_account_cleanup.sql`, nakon osnovne sheme. Za vrlo staru bazu prvo slijedi starija migracija vode; ona se ne pokreće preko novijih water-entry RPC-a.

Nije postavljen ni objavljen hosted Preview. Prije testova koji na njemu mijenjaju podatke treba koristiti **zaseban Supabase testni projekt/bazu**, s njegovim URL-om, javnim ključem i server servisnim ključem u Vercel **Preview** postavkama; ne koristiti produkcijske vrijednosti. Testna baza treba iste relevantne migracije i isključivo testne račune. Odvojeni testni AI ključ/budžet omogućuje kontrolirane stvarne AI provjere. Ne treba dodavati testnu bazu u produkcijske postavke.

## Što ostaje ručno

- Na fizičkom iPhoneu i Androidu: instalacija PWA-a, offline ponovno otvaranje, ponovno pokretanje nakon zatvaranja aplikacije i stvarna V1 → V2 nadogradnja dok je druga kartica otvorena.
- Kamera na telefonu: dopuštenje/odbijanje, očitanje stvarnog EAN/UPC-a, nepoznat proizvod, prekid kamere, ponovni pokušaj i nutritivna deklaracija pića u ml.
- Tipkovnica s decimalnim zarezom, uređivanje 0,5/1,25, fokus dijaloga, veći tekst te VoiceOver/TalkBack.
- Na odvojenom testnom Supabaseu: stvarna registracija/e-mail/Magic Link/obnova/odjava, dva računa u dvije kartice i dva uređaja, konflikt/offline oporavak, te brisanje isključivo testnog računa uz očuvanje drugoga.
- Stvarni AI upiti i izvori, trajni limiti nakon ponovnog pokretanja instance i postavke dnevnog/globalnog budžeta za 50–100 korisnika. Lokalni testovi nisu test opterećenja tih usluga.

Huawei integracija ostaje izvan uvjeta ove bete. Šira javna distribucija zahtijeva rezultate stvarne zatvorene bete i dovršene provjere uređaja, usluga i pravnih podataka.

## Procjena spremnosti

Iz zadanog popisa nema preostale potvrđene blokade u pregledanom kodu; lokalne provjere navedenih popravaka prolaze. **Kod je kandidat za zatvorenu betu s 50–100 korisnika.** Prije slanja pozivnica treba završiti gore navedenu provjeru na stvarnim telefonima i odvojenoj testnoj cloud bazi, posebno prijavu/obnovu, dva uređaja, brisanje testnog računa te stvarnu PWA nadogradnju. Kapacitet i trošak stvarnih usluga za taj broj korisnika nisu izmjereni lokalnim regresijama. Širu javnu distribuciju još ne proglašavam spremnom.

Grana je pripremljena lokalno za pregled; nije poslana na udaljeni repozitorij, spojena u `main` ni automatski objavljena.
