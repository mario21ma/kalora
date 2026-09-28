# Kalora — dnevnik prehrane

Funkcionalna PWA aplikacija na hrvatskom, s Next.jsom, Reactom, TypeScriptom, Tailwindom i pristupačnim Radix/shadcn kontrolama. Ciljana je za iPhone, uz prilagodbu za desktop i Android. Animacije su izvedene CSS-om da se izbjegne dodatni animacijski paket.

## Najbrže pokretanje na Windowsu

1. Instaliraj Node.js 24 LTS sa službene stranice https://nodejs.org/.
2. Raspakiraj projekt.
3. Dvaput klikni `START-WINDOWS.bat` ili u PowerShellu u toj mapi pokreni:

```powershell
npx --yes pnpm@11.25.0 install --frozen-lockfile
npx --yes pnpm@11.25.0 dev
```

4. U pregledniku otvori http://localhost:3000.

Za lokalni dnevnik ne treba račun. Prvo se otvara jasno označen demo s Marijevim primjerima. Odaberi **Započni svoj dnevnik** za onboarding i prazni osobni dnevnik. Demo vrijednosti nisu individualna preporuka prehrane. Za automatsku AI procjenu bilo koje hrane treba server-side `OPENAI_API_KEY`; bez njega aplikacija ostaje funkcionalna za dnevnik i ograničeni lokalni unos poznatih namirnica.

Za provjeru produkcijske verzije i offline načina:

```powershell
npx --yes pnpm@11.25.0 build
npx --yes pnpm@11.25.0 start
```

Service worker se namjerno ne registrira u razvojnom načinu. Lokalni podaci su u pregledniku, pa ih prije brisanja podataka preglednika izvezi kroz Profil. ZIP ne sadrži node_modules ni gotov poslužitelj; prvi put instalacija treba internet.

## Što radi bez vanjskih računa

- Danas: kalorijski prsten, makronutrijenti, dnevni i zadani ciljevi.
- Glavni unos je AI-first: korisnik napiše obrok prirodnim hrvatskim jezikom, a AI procjenjuje namirnice, gramažu, kalorije i makronutrijente.
- Primjeri: „2 jaja, 2 fete kruha, 50 g pršuta i jednu bananu”, „ručak: 3 srednje punjene paprike i oko 60 g bijelog kruha”, „tanjur rižota s piletinom”, „pola pizze capricciose”.
- Hrana **ne mora postojati u lokalnom katalogu**. Ako je jelo prepoznatljivo, AI vraća generičku procjenu na 100 g i označava količinu kao procjenu. Ručni unos deklaracije ostaje samo opcija za korisnika koji želi precizne vrijednosti određenog proizvoda.
- Ako AI nije povezan ili nema interneta, aplikacija može lokalno prepoznati ograničeni skup poznatih namirnica; nepoznate stavke tada se ne izmišljaju.
- Deterministički izračun iz nutritivnih vrijednosti na 100 g. Sačuvane stavke imaju snimku nutritivnih vrijednosti, pa kasnija promjena proizvoda ne mijenja povijest. AI procijenjene namirnice spremaju se kao lokalni cache za brže buduće unose.
- Uređivanje, premještanje, brisanje i Undo. Pomak ulijevo otkriva brisanje; ista radnja je uvijek dostupna u dijalogu.
- Pretraga, često korištene namirnice i omiljeni obroci s pregledom prije dodavanja.
- Lokalni pomoćnik za ostatak kalorija/proteina, tjedni prosjek i osnovne naredbe dodaj/promijeni/obriši. Višeznačne stavke traže precizniju naredbu. Izmjene se potvrđuju.
- Povijest: kalendar, dan, posljednjih 7 ili 30 dana; prosjeci za zabilježene dane, bez lažnih nula za nedostajuće dane.
- Unos težine, graf i razdoblja 7/30/90/180/365 dana. Točke su spojene ravnim segmentima da se ne sugeriraju izmišljene međuvrijednosti.
- Profil, Mifflin–St Jeor BMR/TDEE prijedlog, ručna promjena ciljeva, onboarding.
- Svijetla/tamna/sustavna tema, safe areas, reduced-motion, tipkovnica i čitači zaslona.
- Izvoz/uvoz JSON sigurnosne kopije; uvoz zamjenjuje postojeći dnevnik i nudi Undo.
- Manifest, PNG ikone, apple-touch-icon, samostalni prikaz i predmemorija osnovnog sučelja za offline rad nakon posjeta produkcijskoj aplikaciji.

## Povezivanje Supabasea

1. U svom Supabase računu napravi projekt.
2. U SQL Editoru izvrši `supabase/schema.sql` **jednom na novom projektu**. Skripta kreira tablice, RLS i RPC funkcije u jednoj transakciji. Nije migracija za prepisivanje postojeće produkcijske baze.
3. Kopiraj `.env.example` u `.env.local`.
4. Upiši Project URL i javni `anon` API ključ u `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Nikada ne stavljaj service-role ključ u frontend.
5. Authentication → URL Configuration: postavi Site URL na svoju produkcijsku adresu i dodaj dopušteni razvojni URL `http://localhost:3000`. Za dodatne adrese dodaj točne redirect URL-ove.
6. Uključi Email provider. Za stvarne korisnike konfiguriraj svoj SMTP i provjeri ograničenja slanja e-mailova u svom planu.
7. Ponovno pokreni razvojni poslužitelj ili objavi novu verziju. Prijava lozinkom, registracija i Magic Link su u Profilu.

Lokalni demo i svaki prijavljeni račun imaju odvojene predmemorije. Demo se **ne uvozi automatski** u račun. Za prijenos izvezi lokalni dnevnik, prijavi se pa uvezi datoteku.

Spremanje se radi transakcijski kroz `save_diary(document, expected_revision)`. Promjene se čuvaju na uređaju odmah, zatim sinkroniziraju. `load_diary()` sastavlja dokument iz normaliziranih tablica. Ako drugi uređaj promijeni bazu, revision provjera sprječava tiho prepisivanje. Sučelje nudi izvoz lokalne kopije i učitavanje oblaka. Nema automatskog spajanja konflikata.

Tablice: profiles, food_items, meals, meal_items, daily_targets, weight_entries, favorite_meals, favorite_meal_items, ai_conversations, ai_messages i ai_usage. Relacije djece uključuju i user_id, čime se sprječava povezivanje sa zapisom drugog korisnika. Promjenjivi nutritivni/profilni podaci čuvaju se u JSONB stupcima uz relacijske vlasnike, datume i strane ključeve. Baza pohranjuje vlasničke namirnice; generički početni katalog je u aplikaciji.

## Povezivanje stvarnog AI-ja

1. U svom OpenAI API projektu stvori ključ i podesi potrošnju/limit.
2. Postavi `OPENAI_API_KEY` na poslužitelju. Ključ **ne smije** imati prefiks NEXT_PUBLIC_.
3. Zadani model je `gpt-6-luna`, jer je prikladan za kratke, česte i troškovno osjetljive strukturirane upite. Možeš ga promijeniti kroz `OPENAI_MODEL`.
4. `OPENAI_REASONING_EFFORT=low` drži latenciju i trošak niskima za ovu vrstu zadatka.
5. `ALLOW_ANONYMOUS_AI=true` omogućuje AI procjenu i bez Supabase prijave, pa privatna PWA može koristiti lokalni dnevnik i AI odmah. Ako aplikaciju javno objavljuješ većem broju korisnika, razmotri `false` kako anonimni korisnici ne bi trošili tvoj API budžet.
6. Za prijavljene korisnike zahtjevi i dalje prolaze kroz Supabase provjeru i postojeći limit od 40 AI zahtjeva po korisniku na sat.

`/api/analyze` je AI-first. Klijent šalje opis obroka i samo relevantne korisničke namirnice; poznate stavke koriste spremljene vrijednosti, a svaka druga **prepoznatljiva** hrana/jelo dobiva generičku AI procjenu. `unknown` se koristi samo za dio teksta koji se stvarno ne može protumačiti. Nema obaveznog ručnog unosa kalorija.

Za prijavljenog korisnika chat čita dnevnik iz baze. Za gosta s uključenim anonimnim AI-jem klijent šalje samo kontekst potreban za razgovor: obroke odabranog dana, cilj, 7-dnevne sažetke i posljednjih 8 poruka. OpenAI zahtjev ima `store:false`; to ne znači da pružatelj nema nikakvo operativno zadržavanje podataka.

AI vraća strukturirani JSON koji prolazi Zod provjeru. Za namirnicu iz kataloga kalorije se računaju deterministički iz spremljenih vrijednosti. Za novu prepoznatljivu hranu AI procjenjuje vrijednosti na 100 g, stavka se označava kao procjena i nakon potvrde može se spremiti kao lokalni cache. Chat ne izvršava proizvoljan kod ni SQL. Promjenu/brisanje nudi tek za postojeći ID stavke i traži potvrdu.

ChatGPT pretplata i OpenAI API naplata su odvojeni. Ova PWA koristi server-side OpenAI API ključ; „prijava kroz ChatGPT” ne financira API pozive.

## Vercel i instalacija na mobitel

Nije izvršena objava u tuđi Vercel račun i paket nema javni URL. Za objavu:

1. Postavi projekt u svoj Git repozitorij i uvezi ga u Vercel kao **Next.js** projekt, ili iz mape projekta pokreni službeni Vercel CLI i prijavi se.
2. Install: `pnpm install --frozen-lockfile`; Build: `pnpm build`. Vercel postavke su u `vercel.json`.
3. Postavi varijable iz `.env.example` kroz Vercel Environment Variables. Javni Supabase parametri trebaju biti prisutni u trenutku builda, a OpenAI ključ samo na poslužitelju.
4. Objavi, dodaj dobivenu HTTPS adresu u Supabase Site URL i Redirect URLs, pa provjeri e-mail potvrdu i Magic Link.
5. U Safariju na iPhoneu otvori HTTPS adresu → Dijeli → Dodaj na početni zaslon. Android koristi izbornik instalacije preglednika.

PWA može čuvati sučelje i lokalni dnevnik bez mreže. Prijava, sinkronizacija i AI trebaju internet. iOS sam određuje splash screen iz PWA postavki i ikone; aplikacija ima i vlastiti početni loading ekran.

## Provjere i granice ove isporuke

**Izvorni paket je prije ove AI-first izmjene imao prolazan produkcijski Next.js build, TypeScript i testove parsera/baze.** Nakon ove izmjene napravljena je statička provjera TypeScript/TSX sintakse, ali u ovom radnom okruženju nije bilo moguće ponovno instalirati pnpm pakete iz registra pa puni `pnpm typecheck/test/build` treba pokrenuti lokalno nakon `pnpm install`. Test baze iz izvornog paketa bio je izvršen lokalno uz simulirani `auth.uid()`, ne na povezanom Supabase projektu.

**Preglednik:** dodavanje četiri stavke, trajnost nakon osvježavanja, izmjena gramaže, Undo, višeznačna naredba brisanja, kalendar/povijest, mobilni prikaz na 390 px i tamna tema. Mobilni raspored provjeren je u Chrome iframeu te širine, ne na fizičkom iPhoneu.

**Nije provjereno uživo u ovom paketu:** stvarni OpenAI odgovor bez vašeg API ključa, slanje prijavnih e-mailova, stvarna višeurеđajna Supabase sinkronizacija, produkcijsko HTTPS offline ponašanje i instalacija u iOS Safari. AI endpointi su pripremljeni za strukturirani odgovor i lokalni/anonimni način, ali produkcijsku provjeru treba napraviti s vašim ključem i objavljenom adresom.

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
- `tests/domain.test.mjs`: provjere ključnih pravila.

```powershell
npx --yes pnpm@11.25.0 test
npx --yes pnpm@11.25.0 typecheck
```

Tehničke reference: https://developers.openai.com/api/docs/guides/structured-outputs i https://supabase.com/docs/guides/auth.
