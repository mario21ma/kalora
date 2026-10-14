# Kalora — upute za zamjenu datoteka

Ovaj paket sadrži 21 datoteku za zamjenu i 16 novih datoteka. Točan popis je u [POPIS_DATOTEKA.md](POPIS_DATOTEKA.md). Sve su u mapi projekt/, sa sačuvanim izvornim putanjama. Paket je pripremljen za postojeći projekt; nije izvršena objava, izmjena produkcijske baze ni promjena ključeva.

## 1. Sačuvaj postojeće stanje

Sačuvaj kopiju trenutačnog projekta ili njegov Git commit i dostupnu Supabase sigurnosnu kopiju prije SQL migracija. Ako imaš nesinkronizirane lokalne unose, izvezi dnevnik iz Profila. Zadrži postojeći .env.local i postojeće Vercel vrijednosti.

Paket je napravljen prema polaznoj verziji navedenoj u manifestu. Ako si nakon te verzije radio vlastite izmjene u istim datotekama, usporedi ih prije zamjene. Git provjera iz sljedećeg koraka može pokazati da patch više nije primjenjiv.

Nadogradnja ne traži brisanje podataka preglednika, localStoragea ili PWA-a. Kopije korisničkih dnevnika treba sačuvati.

## 2. Zamijeni i dodaj datoteke lokalno

Raspakiraj ZIP u zasebnu mapu. U mapi projekt/ nalaze se datoteke koje treba prenijeti u korijen svojeg postojećeg Kalora projekta, gdje su package.json, app/, lib/ i public/.

- Kopiraj sadržaj projekt/ u postojeći projekt.
- Zamijeni 21 navedenu postojeću datoteku i dodaj svih 16 novih.
- Zadržavaj postojeće mape i ostale datoteke. Ako tvoj alat zamjenjuje cijelu mapu umjesto spajanja sadržaja, prenesi datoteke pojedinačno prema popisu.
- .env.example je samo predložak; vlastiti .env.local i ključevi ostaju tvoji.
- sql_preduvjeti/ i druge pomoćne datoteke paketa služe za instalaciju i ne treba ih kopirati u aplikaciju.

Ako koristiš Git, možeš umjesto ručnog kopiranja iz korijena svojeg projekta primijeniti priloženi patch. Prvo provjeri:

    git apply --check /putanja/do/kalora-beta-popravci.patch

Tek ako provjera prođe, primijeni:

    git apply /putanja/do/kalora-beta-popravci.patch

Izaberi ručno kopiranje ili patch, jer su to dva načina primjene istih izmjena.

Spremanje u povezanu main granu na GitHubu može automatski pokrenuti Vercel produkcijsku objavu. Prvo dovrši SQL i provjeri varijable, pa tek onda pošalji commit u produkcijsku granu ili ručno objavi.

## 3. Provjeri build

Koristi Node.js 22 i pnpm 11.25.0. U korijenu projekta pokreni:

    pnpm install --frozen-lockfile
    pnpm test
    pnpm test:database
    pnpm typecheck
    pnpm build

Ako nemaš pnpm, pojedine naredbe možeš izvršiti preko npx --yes pnpm@11.25.0, npr. npx --yes pnpm@11.25.0 install --frozen-lockfile.

Lokalno već prolazi 150/150 osnovnih testova, 7/7 SQL provjera, TypeScript, produkcijski build i 25/25 pregledničkih provjera. Detalji su u projekt/BETA_FIXES.md. Za pregledničke testove instaliraj Playwright Chromium, pokreni produkcijski poslužitelj na portu 3001 pa testove u drugom terminalu:

    pnpm exec playwright install chromium
    pnpm start --port 3001

U drugom terminalu, također u korijenu projekta:

    pnpm test:browser

Ovi testovi koriste sintetičke račune/AI odgovore i lokalni PostgreSQL. Oni ne provjeravaju tvoj stvarni Supabase projekt.

## 4. Provjeri Vercel postavke

U Vercel → projekt → Settings → Environment Variables provjeri postojeće vrijednosti za odgovarajuće okruženje.

| Varijabla | Uloga |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Postojeća javna adresa tvojeg Supabase projekta. |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Postojeći javni anon ključ. |
| NEXT_PUBLIC_SUPPORT_EMAIL | Stvaran kontakt koji treba biti prikazan u pravnim dokumentima. |
| SUPABASE_SERVICE_ROLE_KEY | Poslužiteljski ključ za brisanje računa i trajne AI kvote. |
| OPENAI_API_KEY | Poslužiteljski ključ za stvarni AI. |

Javne NEXT_PUBLIC_ vrijednosti čitaju se pri buildu. Servisni i OpenAI ključ ostaju poslužiteljske tajne. Koristi postojeće radne vrijednosti; prazna mjesta u .env.example nisu zamjena za njih.

Zadrži postojeći radni OPENAI_MODEL/OPENAI_REASONING_EFFORT. Primjer modela u .env.example nije obvezna promjena tvoje produkcijske konfiguracije. Za betu je preporučeno ALLOW_ANONYMOUS_AI=false. Provjeri i vlastite AI_USER_*, AI_ANON_* i AI_GLOBAL_* limite/budžet. Zadani globalni 500 zahtjeva dnevno treba uskladiti s 50–100 korisnika i očekivanom upotrebom; nije točan novčani limit.

Provjeri Node.js 22.x i da projekt koristi pnpm build. Novi vercel.json koristi pnpm install --frozen-lockfile.

## 5. Izvrši SQL u postojećem Supabase projektu

Nova migracija je projekt/supabase/ai_quota_account_cleanup.sql. Ostale tri priložene SQL datoteke u sql_preduvjeti/ neizmijenjene su postojeće migracije; služe kao preduvjeti.

Najprije u Supabase → SQL Editor izvrši prvi SELECT iz PROVJERA_BAZE.sql. Očekuje se da profiles, ai_usage, load_diary i save_diary postoje. Ako ne postoje, potrebna je provjera starije/drugačije baze prije primjene ovog paketa.

Na postojećoj bazi **nemoj ponovno izvršavati schema.sql**.

Izvrši ovim redom:

1. Samo ako provjera pokaže daily_water = false: sql_preduvjeti/water_migration.sql.
2. sql_preduvjeti/water_entries_migration.sql.
3. sql_preduvjeti/ai_rate_limit_migration.sql.
4. projekt/supabase/ai_quota_account_cleanup.sql.

Izvrši svaku cijelu datoteku, uključujući BEGIN/COMMIT. Zadnje tri migracije podržavaju ponovno izvršavanje; čuvaju dnevnik i aktivne korisničke/globalne/anonimne kvote. Novi cleanup uklanja AI minute/hour/day metapodatke obrisanog računa i povijesne orphan UUID scope zapise. Treba ovlašteni SQL Editor koji smije postaviti trigger na auth.users.

Staru water_migration.sql nemoj izvršavati nakon water_entries_migration.sql jer bi vratila starije load/save RPC funkcije.

Nakon migracija izvrši sve upite iz PROVJERA_BAZE.sql. U prvoj provjeri sve navedene vrijednosti trebaju biti true. Očekuju se dva cleanup/owner triggera s tgenabled = O, a oba water RPC-a trebaju individual_water = true.

Ako neka migracija prijavi pogrešku, zaustavi daljnju objavu i sačuvaj poruku. Ako SQL Editor kaže da je transakcija prekinuta, izvrši ROLLBACK prije sljedećeg pokušaja. Bez utvrđenog uzroka nemoj nastaviti na sljedeću migraciju.

Ako tek sada uvodiš individualne unose vode, stariji klijenti bez waterEntries mogu nakon promjene RPC-a odbiti spremanje dok ne učitaju novi kod. SQL i novu objavu zato planiraj zajedno. Korisnike uputi da zatvore/ponovno otvore aplikaciju na mreži; zadrže lokalne podatke i nesinkronizirane izvoze.

## 6. Ručna objava i stvarne provjere

Tek nakon uspješnog builda, SQL-a i provjere varijabli objavi novi build svojim postojećim Vercel postupkom. Promjena build-time varijabli zahtijeva novi build. Paket sam ne objavljuje aplikaciju.

Prije pozivnica za betu koristi dva namjenska testna računa i provjeri:

- Registraciju i potvrdu e-maila, prijavu/Magic Link, obnovu sesije i odjavu.
- Dvije kartice: promjena računa, uključujući promjenu tijekom obnove; svaki račun mora prikazivati svoje podatke.
- Brisanje/uređivanje pa dodatni unos hrane i vode pa Poništi; dodatni unosi moraju ostati.
- Nevaljanu količinu i decimalni zarez, hranu u g i napitak u ml.
- Sinkronizaciju na dva uređaja, konflikt i izvoz/vraćanje sačuvane kopije.
- Offline osvježavanje/ponovno otvaranje i PWA ažuriranje sa stare na novu verziju.
- Stvarnu kameru, poznat/nepoznat barkod i ponovni pokušaj na iPhoneu/Androidu.
- Nekoliko kontroliranih AI primjera, oznaku procjene/izvore i 429/503 ograničenja.
- Brisanje isključivo namjenskog testnog računa: podaci i lokalne kopije nestaju, drugi testni račun ostaje očuvan.
- Objavljeni kontakt, privatnost i uvjete.

Detaljan popis stvarnih provjera i njihova razlika od lokalnih rezultata nalazi se u projekt/BETA_FIXES.md. Huawei nije uvjet ove bete.

## 7. Povrat ako objava ima problem

Sačuvana prethodna verzija projekta/deploymenta služi za povrat. Vraćanje samo Vercel koda na vrlo staru verziju bez waterEntries nije potpun rollback nakon novog water RPC-a. Dodatne SQL migracije zadrži; ne briši tablice i ne koristi staru water migraciju za poništavanje nove. Potpuni povrat baze zahtijeva zaseban plan očuvanja novih upisa nastalih nakon sigurnosne kopije.

Kod je lokalno provjeren i spreman za pregled/pripremu objave. Zatvorena beta još ovisi o stvarnim provjerama tvojeg projekta i uređaja.
