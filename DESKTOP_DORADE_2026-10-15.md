# Kalora: dorada prikaza na računalu — 15. listopada 2026.

Izmjene su pripremljene na zasebnoj grani `codex/desktop-polish-2026-10-15`, prema main verziji `2e37a54` (UI 6.5). Aplikacija nije automatski objavljena u produkciju.

## Što se mijenja

- Na računalu lijeva navigacija ostaje dostupna i uključuje Profil. Širi središnji stupac prikazuje dnevnu energiju, siluete, makronutrijente i dnevnik.
- Od širine 1100 px voda je u zasebnoj kartici desno, iznad tjednog pregleda, omiljenih obroka i težine. Postoji jedna kontrola za dodavanje vode. Upisana količina ostaje sačuvana pri promjeni širine prozora; promjena računa odbacuje prethodni nespremljeni unos.
- U proširenom obroku na računalu namirnica, količina i kalorije imaju svoje stupce, uz gumb Uredi. Dugi nazivi se prelamaju.
- Od 1100 px unos hrane prikazuje ulazne kontrole lijevo i pregled za potvrdu desno. U užem prozoru i na mobitelu prikaz je u jednom stupcu. Spremljene namirnice, favoriti, barkod, lokalna/AI analiza, provjera količine i potvrda spremanja koriste postojeće radnje.
- Desktop kontrole imaju jasniji prikaz fokusa tipkovnice i prelaska mišem. Zatvaranje uređivanja vraća fokus na gumb koji ga je otvorio, ako on još postoji; prijelaz na drugi dijalog ne krade njegov fokus.

Oba izgleda, Klasični i Kompaktni, ostaju dostupna u Profil → Izgled aplikacije. Mobilni raspored, voda, siluete i postojeće boje/trake makronutrijenata ostaju. Novi desktop raspored uključuje se automatski prema širini prozora; nema dodatne postavke.

Nema novih AI poziva, ovisnosti, varijabli okruženja, SQL migracija ni promjene formata dnevnika. Korisnički podaci, sigurnosne kopije i `.env.local` ne brišu se.

## Lokalne provjere

Rezultati su zabilježeni nakon konačne provjere; testovi koriste Node.js 22, pnpm 11.25.0 i lokalni produkcijski Next.js build.

| Provjera | Rezultat |
| --- | --- |
| `pnpm test` | 217/217 prolazi |
| `pnpm test:database` | 7/7 prolazi, lokalni PGlite |
| `pnpm typecheck` | prolazi |
| `pnpm build` | prolazi, produkcijski Next.js build |
| `pnpm test:browser` | 53/53 prolazi, bez preskočenih testova |
| Pregledničke JavaScript pogreške / neočekivani vanjski pozivi | nema u testiranim scenarijima |
| `git diff --check` | prolazi |

Preglednički prolaz uključuje 8 novih desktop scenarija i postojeće provjere izolacije računa, obnove tokena, Undo radnji, punog lokalnog spremišta pri brisanju računa, oporavka i sukoba te 8 provjera stvarnog Chromium service workera (uključujući V1 → V2 i zakašnjele zahtjeve). Novi test tipkovnice prije popravka reproducirao je gubitak fokusa; nakon popravka prolaze i povratak fokusa i prijelaz na drugi dijalog.

Novi preglednički scenariji u `tests/desktop-browser.mjs` provjeravaju oba rasporeda na 1024/1100/1280/1440/1920 px, duga imena namirnica, navigaciju u Profil, pomicanje kontrole vode preko granice 1100 px, očuvanje drafta, jedan zapis vode po potvrdi, g/ml i decimalne količine u pregledu, blokiranje nule, promjenu širine otvorenog modala, odustajanje tipkovnicom, mobilne širine 320/390/760 px te promjenu računa u dvije kartice.

Snimke zaslona napravljene su iz stvarnog lokalnog builda sa sintetičkim dnevnikom, bez produkcijskih podataka: oba izgleda na 1280/1440/1920 px i 320/390 px te unos hrane u dva stupca. To nisu ilustracije generirane AI-jem.

## Kako ponoviti pregledničke provjere

U korijenu projekta nakon `pnpm install --frozen-lockfile` i `pnpm build`:

```powershell
pnpm exec playwright install chromium
pnpm start --port 3001
```

U drugom PowerShell prozoru, u istoj mapi:

```powershell
$env:KALORA_BROWSER_URL = "http://127.0.0.1:3001"
pnpm test:browser
```

Testovi dnevnika simuliraju autentikaciju i RPC te blokiraju neočekivane vanjske zahtjeve. PWA testovi koriste lokalni HTTP poslužitelj i pravi Chromium service worker. SQL testovi koriste lokalni PGlite; ne spajaju se na produkcijsku bazu.

## Što još ručno provjeriti

- Na stvarnom telefonu otvoriti oba izgleda, dodati vodu i hranu, otvoriti/zatvoriti tipkovnicu, okrenuti zaslon te provjeriti donju navigaciju i skrolanje modala.
- Na računalu provjeriti uobičajeni preglednik, povećanje prikaza 125–200%, tipkovnicu i miš. Automatska provjera Chromiuma ne potvrđuje Safari/Firefox ili pomoćne tehnologije.
- Nakon zasebno odobrene objave otvoriti aplikaciju online i ponovno pokrenuti postojeći instalirani PWA. Ne brisati podatke radi nadogradnje.

Stvarni Supabase, produkcijska prijava/sinkronizacija, AI model, kamera i instalacija PWA na fizičkom telefonu nisu provjereni ovim lokalnim UI testovima. Hosted Preview s testovima koji mijenjaju podatke treba zasebnu testnu Supabase bazu. Ovaj paket ne mijenja prethodnu procjenu produkcijske sigurnosti.
