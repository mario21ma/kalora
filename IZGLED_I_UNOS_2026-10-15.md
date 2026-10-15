# Kalora — dva rasporeda i jasniji unos hrane

Izmjene su pripremljene prema `main` verziji `e006908` (UI 6.3), uz očuvanje prethodnih beta popravaka. Nova grana je `codex/layouts-and-food-entry-2026-10-15`. Produkcijski podaci nisu mijenjani i aplikacija nije automatski objavljena.

## Što dobiva korisnik

- **Profil → Izgled aplikacije:** Klasični ili Kompaktni raspored, pet postojećih boja, siluete i praćenje vode na jednom mjestu. Promjena vrijedi nakon **Spremi izgled**.
- **Klasični je zadani.** Stari profili i stare sigurnosne kopije automatski dobivaju Klasični prikaz. Postojeći izbor boje i prikaza čuva se.
- **Kompaktni** smanjuje gornji sažetak, čuva obje siluete s oznakama Hrana/Voda, jasno grupira unos vode i pomiče obroke bliže vrhu. Koristi iste izračune, podatke i radnje kao Klasični.
- **Dodaj hranu:** Opiši, Barkod ili Spremljeno. Često korištene namirnice dostupne su odmah; pretraga spremljenih namirnica, favoriti i točna deklaracija nalaze se u Spremljeno.
- **Provjeri obrok:** količina i podrijetlo nutritivnih podataka prikazuju se odvojeno. Generička ili AI procjena ne postaje provjerena deklaracija kada korisnik upiše grame. Poveznice se pokazuju samo kada postoje.
- Dodavanje favorita u otvoreni pregled zadržava ranije pripremljene stavke i njihove vidljive količine. Spremanje traži završnu potvrdu i valjane količine.
- Izgled se sprema u postojeći profil, prenosi sinkronizacijom i čuva u izvozu/uvozu. Spremanje izgleda ne šalje nespremljene osobne podatke; spremanje osobnog profila čuva najnoviji izgled. Suprotne promjene istog izglednog polja zahtijevaju korisnikov izbor.
- Cilj vode može se urediti u osobnom profilu i kada je prikaz praćenja vode isključen; zapisi vode ostaju sačuvani.

Ponavljanje jučerašnjeg obroka nije dio ove prve dorade. Nisu dodani drugi novi moduli, novi AI pozivi ili novi izvori podataka.

## Primjena paketa

1. Sačuvaj postojeći projekt ili Git commit. Ako imaš novije vlastite izmjene istih datoteka, usporedi ih prije zamjene.
2. Raspakiraj novi ZIP u zasebnu mapu. Iz njegove mape `projekt/` prenesi datoteke na iste putanje u postojeći Kalora projekt. Spajaj sadržaj mapa; nemoj zamijeniti cijele mape.
3. Sačuvaj `.env.local`, ključeve, ostale datoteke i sve korisničke podatke. Nema potrebe za brisanjem localStoragea, sigurnosnih kopija ili instalirane aplikacije.
4. Pokreni lokalne provjere iz nastavka. Primjenu na povezani `main` ostavi nakon pregleda jer može automatski pokrenuti Vercel produkcijsku objavu.
5. U aplikaciji otvori Profil → Izgled aplikacije, odaberi Kompaktni i potvrdi **Spremi izgled**. Promjena boje također se sada potvrđuje tim gumbom.

**Nema nove SQL migracije niti novih okolišnih varijabli.** Postojeće RPC funkcije već spremaju profil u JSONB, a novi `layout` je dio tog profila. Nije potrebno ponovno izvršavati stare SQL skripte zbog ove dorade.

PWA shell cache podignut je na v7 uz očuvanje prethodne zaštite od zakašnjelih zahtjeva. Nakon buduće objave provjeri ažuriranje dok je uređaj online; za ovu nadogradnju nemoj brisati korisničke podatke preglednika.

## Lokalna provjera

Node.js 22.23.3, pnpm 11.25.0, Chromium. Ovisnosti i lockfile nisu mijenjani.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:database
pnpm typecheck
pnpm build
pnpm start --port 3005
# Drugi terminal nakon pokretanja servera:
KALORA_BROWSER_URL=http://127.0.0.1:3005 pnpm test:browser
```

Ako koristiš sistemski Chromium, postavi `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; inače instaliraj preglednik standardnim Playwright postupkom. U PowerShellu varijablu postavljaš kroz `$env:KALORA_BROWSER_URL = "http://127.0.0.1:3005"`, a zatim pokrećeš `pnpm test:browser`.

| Provjera | Rezultat |
|---|---|
| Osnovni testovi | 217/217 |
| SQL testovi | 7/7; uključuju novi izgled kroz postojeći JSONB i očuvanje unosa |
| TypeScript | Prošlo |
| Produkcijski build | Prošlo; konačni Next.js produkcijski build |
| Preglednički testovi | 44/44 u punom završnom prolazu + 1/1 naknadno dodana regresija za 320 px; bez preskakanja |
| Vizualni pregled | 320/390/430/768/1280 px bez horizontalnog prelijevanja; veći tekst na 320/390 px; kontrola vode na 320 px visoka 46 px |

Osnovni testovi pokrivaju zadani izgled starih profila, uvoz/izvoz, spajanje postavki i njihove sukobe, čuvanje osobnih nacrta i odvojene oznake količine/izvora. Pregledničke regresije obuhvaćaju postojeće funkcije i nove rasporede, promjenu računa u dvije kartice, spremanje/ponovno otvaranje, g/ml, favorite kroz pregled i Undo nakon novijih unosa.

Dodatno je na stvarnom konačnom buildu i service workeru v7 potvrđeno da Kompaktni raspored i novi unos vode ostaju nakon offline osvježavanja te zatvaranja i ponovnog otvaranja kartice. Korištena je sintetička sesija, sinkronizacija je bila isključena i nije bilo vanjskih zahtjeva ili JavaScript grešaka. Neovisni pregled nove logike nije našao potvrđenu novu grešku. `git diff --check` prolazi.

SQL koristi odvojene lokalne PGlite baze. Preglednički testovi koriste lokalni produkcijski build, sintetičke račune i simulirane Supabase/AI odgovore; neočekivani vanjski zahtjevi ruše test. PWA testovi koriste stvarni worker/CacheStorage i lokalnu simulaciju V1/V2. To nisu provjere stvarnog Supabase projekta, Vercela, AI modela ili fizičke kamere.

## Još provjeriti na telefonu

- Klasični/Kompaktni, sve boje, siluete i voda uključene/isključene te ponovno otvaranje aplikacije.
- Decimalna tipkovnica, mali zaslon, veći tekst, fokus i VoiceOver/TalkBack.
- Opiši/Barkod/Spremljeno, odabrani datum i obrok, g/ml, favoriti i završna potvrda; stvarna kamera i nepoznat proizvod.
- PWA nadogradnja sa stare na novu verziju, offline ponovno otvaranje i povratak veze.
- Na odvojenoj testnoj Supabase bazi: izgled na dva uređaja, konflikt istodobnih izmjena i stvarna prijava/obnova sesije. Hosted Preview s testovima koji mijenjaju podatke mora koristiti odvojene testne ključeve i bazu.

Izmjene su za pregled i zatvoreno testiranje; prošli lokalni testovi ne zamjenjuju ove provjere na stvarnom uređaju. Nova aplikacijska grana nije automatski objavljena niti spojena u main.
