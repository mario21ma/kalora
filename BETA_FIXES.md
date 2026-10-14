# Kalora — popravci nakon pregleda za betu

Ovaj dokument mapira 18 potvrđenih nalaza iz `KALORA_BETA_REVIEW.md` na izmjene i regresijske provjere. Služi za pregled izmjena i pripremu zatvorene bete. Ne potvrđuje da je novi kod ili SQL primijenjen u produkciji.

## Potvrđeni nalazi i popravci

| Nalaz | Popravak | Kod / regresijska provjera |
|---|---|---|
| 1. Miješanje računa između kartica i tijekom obnove | Sesija, dnevnik, zahtjevi i UI radnje vezani su uz vlasnika i generaciju sesije; promjena identiteta prekida primjenu starih rezultata. Promjene auth pohrane obavještavaju ostale kartice. | `lib/cloud.ts`, `lib/diary-store.ts`, `app/page.tsx`; `tests/session.test.mjs`, `tests/diary-store.test.mjs`, `tests/browser-regressions.mjs` |
| 2. Zakašnjeli 401 vraća prethodni račun | Obnova i ponavljanje provjeravaju izvornu sesiju prije slanja, pri odgovoru i prije spremanja; A → B → A ne oživljava staru operaciju. | `lib/cloud.ts`; `tests/session.test.mjs`, pregledničke promjene tijekom 401/refresh |
| 3. Snapshot Undo briše kasnije unose | Poništavanje vraća samo dotaknute zapise/polja koja još odgovaraju poništavanoj radnji. Hrana, voda, favoriti, težina, uvoz i onboarding čuvaju kasnije neovisne promjene. Undo je vezan uz račun. | `lib/undo.ts`, `app/page.tsx`; `tests/undo.test.mjs`, preglednički Undo nakon dodatne hrane/vode/favorita/težine/uvoza/onboardinga |
| 4. Prikazana nevaljana količina sprema staru | Tekst količine je kontroliran, nevaljano polje ima pogrešku i blokira potvrdu; valjan decimalni zarez sprema prikazanu vrijednost. | `lib/quantity.ts`, `app/page.tsx`; `tests/quantity.test.mjs`, `tests/browser-regressions.mjs` (0, prazno, abc, 5001, negativno) |
| 5. Lokalni parser izjednačava g/ml | Jedinica se provjerava i kada nije izričito spremljena; nedostajuća jedinica i dalje znači g. Ne radi se pretvorba mase/volumena bez gustoće. Novi katalog mlijeka ima ml; povijesni zapisi ostaju nepromijenjeni. | `lib/domain.ts`; `tests/domain.test.mjs` |
| 6. Novi AI napitak gubi ml | Izlazna shema zahtijeva jedinicu količine i osnove; nova hrana čuva ml kroz pregled, dnevnik, cache, favorite i ponovno otvaranje. | `app/api/analyze/route.ts`, `lib/domain.ts`, `app/page.tsx`; `tests/ai-input.test.mjs`, preglednički novi AI napitak |
| 7. Nedokazana oznaka Web provjerena | AI nikada automatski ne dobiva oznaku neovisno provjerene deklaracije. Poveznice ostaju samo ako postoje u dovršenom web pozivu/citatu; AI ostaje procjena i uz izvor. | `lib/ai-server.ts`, `app/api/analyze/route.ts`, `app/page.tsx`; `tests/ai-input.test.mjs` |
| 8. Nemoguća nutritivna osnova | Nova AI/OFF/ručna osnova provjerava razumne granice po g/ml i tolerantan minimum energije. Postojeći dnevnik/uvezeni povijesni zapisi nisu retroaktivno odbačeni. | `lib/domain.ts`, AI i OFF putovi; `tests/domain.test.mjs`, `tests/ai-input.test.mjs` |
| 9. Skener ostaje ugašen nakon pogreške | Kontroler pouzdano zaustavlja pokušaj i dopušta izričit ponovni pokušaj; ne pokreće beskonačne lookup petlje i zanemaruje zakašnjele rezultate nakon zatvaranja ili novog pokušaja. | `lib/barcode-scanner.ts`, `app/page.tsx`; `tests/scanner.test.mjs` (404, 422, mreža, zatvaranje), preglednički stvarni ZXing import uz odbijen pristup kameri i ponovni pokušaj |
| 10. Pokvaren lokalni zapis blokira oblak | Sirovi zapis se čuva, provjerava se oblak i nudi izričit oporavak ili reset. Čitljive kopije izvoze sam State kompatibilan s uvozom; nečitljive čuvaju izvornik. | `lib/diary-store.ts`, `lib/diary-storage.ts`, `app/page.tsx`; `tests/diary-store.test.mjs`, preglednički corrupt recovery |
| 11. Čista sinkronizacija ne dohvaća | Ručna sinkronizacija i povratak u aplikaciju dohvaćaju oblak. Lokalna izmjena tijekom dohvaćanja nije prepisana; umjesto toga čuva se konflikt. | `lib/diary-store.ts`, `lib/use-diary.ts`; `tests/diary-store.test.mjs`, preglednički clean sync |
| 12. Offline nakon V2 vraća V1 | Mrežni odgovor klonira se prije prvog čekanja. Stranica se objavljuje u cache tek nakon dostupnosti svih početnih resursa; nepotpuna V2 čuva V1. | `public/sw.js`; `tests/pwa-deploy.test.mjs` |
| 13. Razlomci i hrvatske brojke daju pogrešnu porciju | Parser prepoznaje uobičajene razlomke/brojke; nerazriješene eksplicitne količine traže pojašnjenje umjesto jedne porcije. | `lib/domain.ts`; `tests/domain.test.mjs` (1/2 avokada, četiri jaja, malformed) |
| 14. Generator predlaže nevaljan cilj | Automatski prijedlog ostaje unutar vlastite validacije kalorija i makronutrijenata za dopuštene profile. | `lib/domain.ts`, `components/profile.tsx`; `tests/domain.test.mjs` (granične kombinacije profila) |
| 15. Nedostaje poveznica na uvjete | Uvjeti i privatnost povezani su iz registracije/profila, a politika ima poveznicu na uvjete. | `app/page.tsx`, `app/privacy/page.tsx`; `tests/browser-regressions.mjs` |
| 16. Offline pravni URL pokazuje početnu stranicu | `/privacy` i `/terms` čuvaju vlastiti sadržaj; nepoznata offline ruta dobiva jasnu poruku i HTTP 503. | `public/sw.js`; `tests/pwa-deploy.test.mjs` |
| 17. Obrisani račun ostaje u AI kvotama | Nova idempotentna migracija briše samo njegove minute/hour/day scope zapise i povijesne canonical orphan zapise. Provjera vlasnika sprječava da prethodno autoriziran zahtjev nakon brisanja ponovno stvori zapis. Aktivne, anonimne i globalne kvote ostaju. | `supabase/ai_quota_account_cleanup.sql`; `tests/account-deletion-database.test.mjs` (stvarni PostgreSQL, 13-tablični cascade, očuvanje kvota, role isolation) |
| 18. Bazni SQL test očekuje Mario | Save/load provjerava točan spremljeni profil umjesto zastarjele zadane vrijednosti; sve kasnije SQL tvrdnje ostaju aktivne. | `tests/database.test.mjs` |

## Očuvanje korisničkih podataka

- Postojeći format `version:1` i nutritivne snimke ostaju čitljivi; nema masovnog preračunavanja povijesti ili preimenovanja g u ml.
- Konflikt, uvoz i oporavak čuvaju lokalnu kopiju po računu prije zamjene. Ako nije moguće sačuvati kopiju, zamjena se zaustavlja umjesto gubitka podataka.
- Istodobno pisanje dviju kartica čuva po jednu najnoviju nesinkroniziranu granu po kontroleru prije pisanja glavnog dnevnika. Različite grane pri ponovnom otvaranju traže izričit oporavak. Potvrda sinkronizacije uklanja samo vlastitu potvrđenu granu; rješavanje konflikta čuva ostale kopije.
- Poništavanje ne uklanja neovisne kasnije unose i ne vraća kasnije uređenu vrijednost preko novije promjene.
- Brisanje računa uklanja njegov glavni lokalni ključ i sve interne kopije na trenutačnom pregledniku. Preuzete JSON datoteke ostaju pod kontrolom korisnika. Brisanje lokalnih kopija na drugom uređaju treba potvrditi stvarnim testom odjavljene/obrisane sesije.
- Tek nakon uspješnog odgovora poslužitelja zapisuje se mala oznaka obrisanog računa, bez sadržaja dnevnika. Ona sprečava da već započeti zapis druge kartice ponovno stvori dnevnik ili kopiju nakon brisanja. Obična odjava i promjena računa ne postavljaju tu oznaku i ne brišu prethodni dnevnik.
- Dnevnik zadržava revision konflikte. Nema novog automatskog spajanja ni novih načina unosa.

## SQL prije beta verzije

Na **novom** projektu izvrši `supabase/schema.sql` jednom. Na postojećem projektu nemoj ponovno stvarati osnovnu shemu.

Zatim izvrši ovim redom:

1. `supabase/water_entries_migration.sql` ako još nije primijenjena.
2. `supabase/ai_rate_limit_migration.sql` ako još nije primijenjena.
3. **Nova** `supabase/ai_quota_account_cleanup.sql`.

Ove tri migracije testirane su za ponovljeno izvršavanje. Za vrlo staru bazu bez `daily_water` prethodno je potrebna `water_migration.sql`; nemoj je pokretati nakon `water_entries_migration.sql`, jer bi vratila stariju verziju RPC funkcija. Cleanup zahtijeva ulogu ovlaštenu za trigger na `auth.users` (Supabase SQL Editor). Funkcije imaju prazan search_path, potpuno kvalificirane tablice i nemaju javno izvršavanje. Prije stvarnog SQL zahvata uzmi postojeću sigurnosnu kopiju i provjeri migracije na stagingu. U ovoj radnoj izmjeni SQL nije izvršen na produkciji.

## Ponovljiva lokalna provjera

Koristi Node.js 22 i pnpm 11.25.0, zatim:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:database
pnpm typecheck
pnpm build
```

Za preglednik instaliraj Playwright Chromium, pokreni `pnpm start --port 3001` i `pnpm test:browser`. SQL koristi lokalni PGlite i simulirani `auth.uid()`. UI koristi lokalni produkcijski build, sintetičke račune i stubove Supabase/AI-ja; PWA provjera koristi simuliranu V1/V2 objavu. Prolaz tih testova ne potvrđuje konfiguraciju stvarnog projekta ili točnost stvarnog modela.

## Završni lokalni rezultati — 14. listopada 2026.

Provjeren je konačan izvor nakon svih popravaka, uključujući zaštitu od pisanja tijekom brisanja računa. Okruženje: Node.js 22.23.3, pnpm 11.25.0 i Chromium.

| Provjera | Rezultat | Granica dokaza |
|---|---|---|
| `pnpm install --frozen-lockfile` | Uspješno | Reproducibilna lokalna instalacija; zaštita starosti paketa ostaje uključena. |
| `pnpm test` | **150/150**, bez preskakanja | Stvarni kontroler dnevnika i auth kod uz kontrolirane pohrane/mrežne odgovore; Undo, količine, AI ulaz, barkod i domain regresije. |
| `pnpm test:database` | **7/7**, bez preskakanja | Stvarne SQL skripte u lokalnom PostgreSQL-u/PGlite; RLS, revizije/rollback, voda, trajne kvote i brisanje. |
| `pnpm typecheck` | Uspješno | Bez TypeScript grešaka. |
| `pnpm build` | Uspješno | Konačan Next.js produkcijski build; stranice i API rute uspješno generirane. |
| `pnpm test:browser` | **25/25**, bez preskakanja | 20 UI provjera na lokalnom produkcijskom buildu, sa sintetičkim računima/odgovorima; 5 provjera stvarnog service workera/CacheStoragea uz simuliranu V1/V2 objavu. |
| HTTP provjera konačnog builda | **9/9** | Početna/pravne stranice, status, manifest, SW i odbijanje nevaljanog ulaza; bez poziva plaćenog AI-ja. |

Pregledničke regresije obuhvaćaju dva računa u dvije kartice s jednakim i različitim revizijama, promjenu prije/tijekom obnove i 401 ponavljanja, zastarjeli AI rezultat/pregled, sve postojeće Undo putove nakon kasnijih unosa, nevaljanu količinu i decimalni zarez, novi AI napitak u ml i ponovno otvaranje, čisto dohvaćanje, korumpiranu kopiju/konflikt, brisanje kopija i pravne poveznice. Skener učitava stvarni ZXing bundle; simulirano odbijanje fizičke kamere potvrđuje pogrešku, ponovni pokušaj i povratak na unos. To nije provjera prepoznavanja barkoda fizičkom kamerom.

Dodatna provjera konačnog produkcijskog builda, uz stvarni service worker i prekid mreže, potvrdila je zasebno offline otvaranje `/`, `/privacy` i `/terms`, bez JavaScript grešaka. Dnevnik sintetičkog računa zadržao je dodatni unos vode nakon offline osvježavanja i zatvaranja/ponovnog otvaranja kartice. Njegova sinkronizacija bila je izričito isključena; stvarni Supabase nije korišten.

Mobilni/desktop pregled obuhvatio je Danas, Povijest, AI, Favorite i Profil na 320, 390, 768 i 1280 px: 20 prikaza bez horizontalnog prelijevanja i JavaScript grešaka. To je Chromium emulacija, uz sintetičku sesiju i offline signal, te ne zamjenjuje VoiceOver/TalkBack ni fizički uređaj. `git diff --check` prolazi. Kod i migracije nisu objavljeni u produkciju.

## Obavezna stvarna provjera prije pozivnica

- [ ] Na staging/produkcijskoj bazi potvrditi migracije, own-row RLS, zabrane `anon` i dostupnost kontroliranih RPC-a. Novi cleanup trigger mora biti aktivan.
- [ ] Potvrditi `NEXT_PUBLIC_SUPABASE_URL`, javni anon ključ, server `SUPABASE_SERVICE_ROLE_KEY` i `OPENAI_API_KEY`; servisni/OpenAI ključ ne smiju biti u klijentskom bundleu. Postaviti stvaran `NEXT_PUBLIC_SUPPORT_EMAIL`.
- [ ] Registracija/e-mail potvrda, lozinka, Magic Link, istek/obnova i odjava sa stvarnim Supabase računima, SMTP-om i HTTPS redirect URL-ovima.
- [ ] Dva računa/dvije kartice: promjena A → B, odjava, promjena tijekom obnove/401 i provjera da nema sadržaja ili zahtjeva pod pogrešnim vlasnikom.
- [ ] Dva uređaja: čisto dohvaćanje udaljene izmjene, istodobne izmjene/konflikt, vraćanje i izvoz lokalne kopije te ponovno otvaranje nakon prekida mreže.
- [ ] Brisanje testnog računa: svih 13 povezanih tablica, korisnički AI scope zapisi, glavni lokalni ključ i interne kopije; drugi račun/globalni/anon podaci očuvani. Provjeriti preostalu sesiju na drugom uređaju.
- [ ] Kontrolirani stvarni AI obroci i napitci: g/ml, netočan/nepotpun odgovor, web izvor/procjena, edit/delete potvrda i trajni 429/503 limiti.
- [ ] Uskladiti AI_USER/AI_GLOBAL kapacitet s 50–100 korisnika i budžetom. Zadani 500/dan nije 500 razgovora; chat dodavanje može trošiti dva poziva. Pratiti stvarne tokene, web trošak, latenciju i pogreške.
- [ ] Fizički iPhone/Android: PWA instalacija, offline ponovno otvaranje, stvarna V1 → V2 nadogradnja, kamera/barkod, nepoznat proizvod i ponovni pokušaj, pića u ml, mobilna tipkovnica.
- [ ] VoiceOver/TalkBack, fokus dijaloga, veći tekst, kontrast i dodirne kontrole na podržanim uređajima.
- [ ] Provjeriti kontakt, privatnost i uvjete na objavljenoj adresi, uključujući offline dostupnost; pravno dovršavanje prije šire javne distribucije.

Huawei integracija nije uvjet ove bete. Ručni upis barkoda, zasebno uređivanje vode i drugi opcionalni prijedlozi iz pregleda nisu dodani ovom popravku.

## Odluka o spremnosti

Lokalne regresije uklanjaju potvrđene prepreke u kodu, ali početak zatvorene bete ovisi o izvršenim produkcijskim migracijama i gore navedenim stvarnim provjerama. Dok te provjere nisu potvrđene, aplikaciju ne treba označiti spremnom za pozivnice. Šira javna distribucija zahtijeva i iskustvo stabilne zatvorene bete, praćenje pogrešaka/troškova i dovršene pravne/uređajne provjere. Izmjene su pripremljene za pregled, bez produkcijske objave.
