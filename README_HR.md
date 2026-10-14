# Kalora — dnevnik prehrane

Funkcionalna PWA aplikacija na hrvatskom, s Next.jsom, Reactom, TypeScriptom, Tailwindom i pristupačnim Radix/shadcn kontrolama. Ciljana je za iPhone, uz prilagodbu za desktop i Android. Animacije su izvedene CSS-om da se izbjegne dodatni animacijski paket.

## Najbrže pokretanje na Windowsu

1. Instaliraj Node.js 22 (verzija iz `package.json`) sa službene stranice https://nodejs.org/.
2. Raspakiraj projekt.
3. Dvaput klikni `START-WINDOWS.bat` ili u PowerShellu u toj mapi pokreni:

```powershell
npx --yes pnpm@11.25.0 install --frozen-lockfile
npx --yes pnpm@11.25.0 dev
```

4. U pregledniku otvori http://localhost:3000.

Aktualno sučelje zahtijeva Supabase registraciju ili prijavu za pristup osobnom dnevniku. Novi račun otvara onboarding i prazni dnevnik. Nakon prijave podaci i sesija ostaju lokalno spremljeni, pa je već otvoreni dnevnik dostupan izvan mreže. Prva prijava zahtijeva internet. Postojeći lokalni/demo podaci nisu obrisani niti se automatski uvoze u drugi račun.

Za stvarnu AI procjenu trebaju server-side `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` i migracija trajnih kvota. Bez AI ključa dnevnik i lokalno prepoznavanje poznatih namirnica rade nakon prijave. Supabase servisni ključ nikada ne smije biti javna varijabla.

Za provjeru produkcijske verzije i offline načina:

```powershell
npx --yes pnpm@11.25.0 build
npx --yes pnpm@11.25.0 start
```

Service worker se namjerno ne registrira u razvojnom načinu. Lokalni podaci su u pregledniku, pa ih prije brisanja podataka preglednika izvezi kroz Profil. ZIP ne sadrži node_modules ni gotov poslužitelj; prvi put instalacija treba internet.

## Dnevnik nakon prijave

- Danas: kalorijski prsten, makronutrijenti, dnevni i zadani ciljevi.
- Glavni unos je AI-first: korisnik napiše obrok prirodnim hrvatskim jezikom, a AI procjenjuje namirnice, gramažu, kalorije i makronutrijente.
- Primjeri: „2 jaja, 2 fete kruha, 50 g pršuta i jednu bananu”, „ručak: 3 srednje punjene paprike i oko 60 g bijelog kruha”, „tanjur rižota s piletinom”, „pola pizze capricciose”.
- Hrana **ne mora postojati u lokalnom katalogu**. AI vraća procjenu na 100 g ili 100 ml, čuva jedinicu i jasno označava nutritivnu procjenu. Web poveznica je izvor korišten u odgovoru, a ne potvrda da je deklaracija neovisno provjerena. Ručni unos deklaracije ostaje opcija za točan proizvod.
- Ako AI nije povezan ili nema interneta, aplikacija može lokalno prepoznati ograničeni skup poznatih namirnica; nepoznate stavke tada se ne izmišljaju.
- Deterministički izračun iz nutritivnih vrijednosti na 100 g. Sačuvane stavke imaju snimku nutritivnih vrijednosti, pa kasnija promjena proizvoda ne mijenja povijest. AI procijenjene namirnice spremaju se kao lokalni cache za brže buduće unose.
- Uređivanje, premještanje, brisanje i Undo. Poništavanje vraća samo promjene te radnje i čuva kasnije neovisne unose/izmjene. Pomak ulijevo otkriva brisanje; ista radnja je dostupna u dijalogu.
- Pretraga, često korištene namirnice i omiljeni obroci s pregledom prije dodavanja.
- Lokalni pomoćnik za ostatak kalorija/proteina, tjedni prosjek i osnovne naredbe dodaj/promijeni/obriši. Višeznačne stavke traže precizniju naredbu. Izmjene se potvrđuju.
- Povijest: kalendar, dan, posljednjih 7 ili 30 dana; prosjeci za zabilježene dane, bez lažnih nula za nedostajuće dane.
- Unos težine, graf i razdoblja 7/30/90/180/365 dana. Točke su spojene ravnim segmentima da se ne sugeriraju izmišljene međuvrijednosti.
- Profil, Mifflin–St Jeor BMR/TDEE prijedlog, ručna promjena ciljeva, onboarding.
- Svijetla/tamna/sustavna tema, safe areas, reduced-motion, tipkovnica i čitači zaslona.
- Izvoz/uvoz JSON sigurnosne kopije; uvoz zamjenjuje postojeći dnevnik, čuva lokalnu kopiju i nudi Undo. Konflikt i oporavak također čuvaju kopiju po računu prije zamjene.
- Manifest, PNG ikone, apple-touch-icon, samostalni prikaz i predmemorija osnovnog sučelja za offline rad nakon posjeta produkcijskoj aplikaciji.

## Povezivanje Supabasea

1. U svom Supabase računu napravi projekt.
2. U SQL Editoru izvrši `supabase/schema.sql` **jednom na novom projektu**. Skripta kreira tablice, RLS i RPC funkcije u jednoj transakciji. Nije migracija za prepisivanje postojeće produkcijske baze.
3. Na novom ili postojećem projektu zatim izvrši, ovim redom:
   - `supabase/water_entries_migration.sql` — migrira postojeće dnevne zbrojeve u pojedinačne unose bez izmišljanja vremena.
   - `supabase/ai_rate_limit_migration.sql` — trajne korisničke, anonimne i globalne AI kvote.
   - `supabase/ai_quota_account_cleanup.sql` — brisanje AI metapodataka računa, čišćenje povijesnih orphan zapisa i zaštita od njihova ponovnog stvaranja.
   Ove tri migracije mogu se ponovno izvršiti; ne resetiraju postojeće dnevnik/aktivne kvote. Za staru bazu koja još nema `daily_water`, prvo izvrši `supabase/water_migration.sql`, **prije** `water_entries_migration.sql`. Staru migraciju nemoj izvršavati nakon nove jer zamjenjuje RPC funkcije.
4. Kopiraj `.env.example` u `.env.local` i upiši Project URL/javni `anon` ključ u `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Postavi `SUPABASE_SERVICE_ROLE_KEY` samo na poslužitelju za brisanje računa i trajne AI kvote.
5. Authentication → URL Configuration: postavi Site URL na odgovarajuću HTTPS adresu i dodaj dopušteni razvojni URL `http://localhost:3000`. Za dodatne adrese dodaj točne redirect URL-ove.
6. Uključi Email provider. Za stvarne korisnike konfiguriraj SMTP i provjeri ograničenja slanja e-mailova u svom planu.
7. Postavi stvaran kontakt `NEXT_PUBLIC_SUPPORT_EMAIL` prije pozivnica za betu. Ponovno pokreni razvojni poslužitelj nakon promjene varijabli. Registracija, lozinka i Magic Link nalaze se na početnom ekranu, a upravljanje računom u Profilu.

Svaki prijavljeni račun ima odvojen dnevnik i lokalne sigurnosne kopije. Promjena računa u drugoj kartici zaustavlja zastarjele zahtjeve i osvježava prikaz. Stari lokalni/demo dnevnik se **ne uvozi automatski** u račun. Za prijenos koristi vlastitu prethodno izvezenu datoteku.

Spremanje se radi transakcijski kroz `save_diary(document, expected_revision)`. Promjene se čuvaju na uređaju odmah, zatim sinkroniziraju. `load_diary()` sastavlja dokument iz normaliziranih tablica. Ručna sinkronizacija i povratak u aplikaciju dohvaćaju promjene drugog uređaja kada lokalni dnevnik nema nespremljenih promjena. Konflikt revizija blokira prepisivanje i čuva lokalnu kopiju po računu. Učitavanje oblaka i oporavak traže izričitu radnju; spremljenu kopiju možeš izvesti ili vratiti. Nema automatskog spajanja konflikata.

Tablice dnevnika/starih kvota: profiles, food_items, meals, meal_items, daily_targets, weight_entries, daily_water, water_entries, favorite_meals, favorite_meal_items, ai_conversations, ai_messages i ai_usage. Relacije djece uključuju user_id, čime se sprječava povezivanje sa zapisom drugog korisnika. `ai_request_usage` sadrži trajne kvote i nije čitljiv klijentima. Brisanje računa uklanja svih 13 povezanih tablica i njegove AI scope zapise, ali čuva anonimne/globalne kvote. Na trenutačnom pregledniku uklanja glavni dnevnik i sve njegove interne sigurnosne kopije; korisnikove preuzete datoteke ostaju pod njegovom kontrolom.

## Povezivanje stvarnog AI-ja

1. U svom OpenAI API projektu stvori ključ i podesi potrošnju/limit.
2. Postavi `OPENAI_API_KEY` na poslužitelju. Ključ **ne smije** imati prefiks NEXT_PUBLIC_.
3. Zadani model je `gpt-6-luna`, jer je prikladan za kratke, česte i troškovno osjetljive strukturirane upite. Možeš ga promijeniti kroz `OPENAI_MODEL`.
4. `OPENAI_REASONING_EFFORT=low` drži latenciju i trošak niskima za ovu vrstu zadatka.
5. Za betu postavi `ALLOW_ANONYMOUS_AI=false`. Ta varijabla kontrolira gostujući pristup API-ju; ne uklanja prijavu koju aktualno sučelje zahtijeva. Anonimni API, ako je namjerno uključen, također zahtijeva Supabase trajne kvote i server ključ.
6. Zahtjevi provjeravaju Supabase korisnika i rezerviraju kvotu kroz `consume_ai_request_quota`. Ako kvote nisu dostupne, AI vraća 503 umjesto nezaštićenog poziva.

Zadani limiti su po korisniku 6/min, 40/h i 200/dan; za anonimni API 3/min, 10/h i 20/dan; globalno 30/min, 100/h i 500/dan. Poslužiteljske varijable `AI_USER_PER_MINUTE`, `AI_USER_PER_HOUR`, `AI_USER_PER_DAY`, odgovarajuće `AI_ANON_*` te `AI_GLOBAL_*` dopuštaju usklađivanje kapaciteta. Za 50–100 korisnika provjeri očekivanu upotrebu i novčani budžet: chat dodavanje koristi dva poziva, a broj zahtjeva nije točan limit troška tokena/web pretrage. Postavi i OpenAI projektni budžet te prati potrošnju i 429/503 odgovore.

`/api/analyze` je AI-first. Klijent šalje opis obroka i samo relevantne korisničke namirnice; poznate stavke koriste spremljene vrijednosti, a svaka druga **prepoznatljiva** hrana/jelo dobiva generičku AI procjenu. `unknown` se koristi samo za dio teksta koji se stvarno ne može protumačiti. Nema obaveznog ručnog unosa kalorija.

Za prijavljenog korisnika chat čita dnevnik iz baze. Za gosta s uključenim anonimnim AI-jem klijent šalje samo kontekst potreban za razgovor: obroke odabranog dana, cilj, 7-dnevne sažetke i posljednjih 8 poruka. OpenAI zahtjev ima `store:false`; to ne znači da pružatelj nema nikakvo operativno zadržavanje podataka.

AI vraća strukturirani JSON koji prolazi Zod provjeru jedinica, količine i razumne nutritivne osnove. Za namirnicu iz kataloga kalorije se računaju deterministički iz spremljenih vrijednosti. Nova hrana/napitak ostaje označena kao AI procjena, uključujući web izvor. Poveznica se čuva samo kada potječe iz dovršene web pretrage/citata. Ne postoji automatska oznaka neovisno provjerene deklaracije. Potvrđeni unosi mogu se spremiti kao lokalni cache s jedinicom i izvorom. Chat ne izvršava proizvoljan kod ni SQL; promjenu/brisanje nudi tek za postojeći ID i traži potvrdu.

ChatGPT pretplata i OpenAI API naplata su odvojeni. Ova PWA koristi server-side OpenAI API ključ; „prijava kroz ChatGPT” ne financira API pozive.

## Vercel i instalacija na mobitel

Nije izvršena objava u tuđi Vercel račun i paket nema javni URL. Za objavu:

1. Postavi projekt u svoj Git repozitorij i uvezi ga u Vercel kao **Next.js** projekt, ili iz mape projekta pokreni službeni Vercel CLI i prijavi se.
2. Koristi Node.js 22 i pnpm 11.25.0. Provjeren lockfile instalira se s `pnpm install --frozen-lockfile`; Build: `pnpm build`. Ako koristiš postojeći `vercel.json`, provjeri i njegov installCommand pri pripremi objave.
3. Postavi varijable iz `.env.example` kroz Vercel Environment Variables. Javni Supabase parametri trebaju biti prisutni u trenutku builda, a OpenAI ključ samo na poslužitelju.
4. Objavi, dodaj dobivenu HTTPS adresu u Supabase Site URL i Redirect URLs, pa provjeri e-mail potvrdu i Magic Link.
5. U Safariju na iPhoneu otvori HTTPS adresu → Dijeli → Dodaj na početni zaslon. Android koristi izbornik instalacije preglednika.

PWA čuva osnovno sučelje i lokalni dnevnik nakon prethodne prijave. Prijava, sinkronizacija, web barkod i AI trebaju internet. Pravne stranice imaju zasebnu offline kopiju. Nova verzija zamjenjuje spremljenu stranicu tek kada su dostupni svi njeni početni resursi. iOS sam određuje splash screen iz PWA postavki i ikone; aplikacija ima i vlastiti početni loading ekran.

## Provjere i granice ove isporuke

Regresijske provjere obuhvaćaju izolaciju računa i token races, Undo s kasnijim promjenama, parser, g/ml, AI validaciju/izvore, barkod, oporavak i konflikte. SQL testovi izvršavaju stvarne skripte u lokalnom PGlite PostgreSQL-u sa simuliranim `auth.uid()`; to nije povezana Supabase baza. Pregledničke provjere koriste Chromium, lokalni produkcijski build i simulirane Supabase/AI odgovore. PWA testovi simuliraju V1 → V2 i provjeravaju offline stranice.

Mapiranje svih 18 nalaza na popravke/testove i popis stvarnih provjera prije pozivnica nalaze se u [BETA_FIXES.md](BETA_FIXES.md). Rezultate lokalnih naredbi razlikuj od produkcijskih provjera: stvarni OpenAI/OFF odgovor, e-mail potvrda/Magic Link, dva fizička uređaja, Supabase migracije/RLS, stvarno brisanje računa te iOS/Android instalacija i kamera zahtijevaju zaseban staging/produkcijski prolaz. Kod nije automatski objavljen ovom izmjenom.

**Druga faza:** fotografiranje hrane/deklaracija, Google/Apple prijava, potpuni prijevodi na EN/DE/IT, native omot i push podsjetnici. Rječnik za zajedničke oznake nalazi se u `lib/i18n.ts`; dulje poruke još treba izdvojiti prije potpune lokalizacije. Početni food katalog ima 20 generičkih namirnica, bez verificirane komercijalne baze; deklaracije proizvoda upisuje korisnik.

Limit dnevnika je 20.000 stavki; za znatno veći višegodišnji dnevnik treba prijeći sa spremanja transakcijske snimke na inkrementalne upise i paginaciju. Autentikacija koristi Supabase HTTP API i rotaciju tokena. Tokeni su u lokalnoj pohrani preglednika: cilj projekta je jednostavna PWA, bez dodatnog SSR session sloja. Pri javnom lansiranju postavi politiku privatnosti i produkcijsku e-mail dostavu za svoju konkretnu uslugu.

## Struktura

- `app/page.tsx`: četiri radna prikaza i tokovi korisnika.
- `components/profile.tsx`, `components/controls.tsx`: profil/onboarding i zajedničke kontrole.
- `lib/domain.ts`: tipovi, Zod sheme, hrana, račun, parser, datumi i BMR/TDEE.
- `lib/use-diary.ts`: lokalno spremanje, red čekanja, sinkronizacija i konflikti.
- `lib/cloud.ts`: Supabase autentikacija i HTTP pozivi.
- `lib/ai-server.ts`, `app/api/*`: provjera prijave, kvota, AI i validacija.
- `supabase/schema.sql`: relacije, RLS, transakcijske funkcije.
- `public/`: PWA ikone, manifest i service worker.
- `tests/`: regresije domene, autentikacije, Undo, AI, SQL-a, pohrane, skenera i PWA ažuriranja.

```powershell
npx --yes pnpm@11.25.0 test
npx --yes pnpm@11.25.0 test:database
npx --yes pnpm@11.25.0 typecheck
npx --yes pnpm@11.25.0 build
```

Pregledničke regresije zahtijevaju instalirani Chromium za Playwright te pokrenuti produkcijski poslužitelj (`pnpm start --port 3001`). Pokreni ih s `pnpm test:browser`; lokalne sintetičke sesije i mrežni stubs dio su testnog harnessa.

Tehničke reference: https://developers.openai.com/api/docs/guides/structured-outputs i https://supabase.com/docs/guides/auth.

## Privatnost, lokalni barkod skener i iOS priprema

- Politika privatnosti i uvjeti korištenja dostupni su na `/privacy` i `/terms`, iz ekrana prijave i profila.
- Postavi `NEXT_PUBLIC_SUPPORT_EMAIL` prije zatvorene bete kako bi dokumenti prikazivali stvarni kontakt.
- ZXing se sada učitava kao npm ovisnost `@zxing/browser@0.2.1` i bundlea se s aplikacijom; više se ne izvršava JavaScript iz `unpkg.com` tijekom skeniranja.
- Capacitor 8.5.2 konfiguracija je u `capacitor.config.ts`; detalji su u `IOS_SETUP.md`.
- Commitaj ažurirani `pnpm-lock.yaml` zajedno s promjenama ovisnosti i provjeri instalaciju s `--frozen-lockfile` prije objave.
