# Kalora — boje i trakice makronutrijenata

Ovo je mala nadogradnja NAKON paketa „novi izgled i unos” (UI6.4). U Kompaktnom prikazu dodaje boje iz mobilnog Klasičnog prikaza: proteini zeleni, ugljikohidrati plavi, masti narančaste. Trakice prikazuju unesenu količinu prema cilju; iznad cilja ostaju pune na100%. Brojevi i ciljevi ostaju vidljivi.

## Što zamijeniti

1. Sačuvaj trenutačni projekt ili Git commit. Ako si dodatno mijenjao vlastiti app/globals.css, usporedi te izmjene prije zamjene.
2. Raspakiraj ZIP u zasebnu mapu.
3. Iz projekt/app/globals.css kopiraj datoteku na app/globals.css u svojem postojećem Kalora projektu. Zamjenjuje se SAMO ta jedna datoteka, ne cijela mapa app.
4. Ne mijenjaj .env.local i ne briši korisničke podatke, localStorage, sigurnosne kopije ili PWA.
5. Za lokalnu provjeru u PowerShellu iz korijena projekta pokreni pnpm build. Ako već nisi uključio Kompaktni: Profil → Izgled aplikacije → Kompaktni → Spremi izgled.

SQL ne treba ponovno pokretati. Nema novih ovisnosti, varijabli ni promjene podataka. Klasični prikaz nije vizualno mijenjan.

Ako koristiš Git, umjesto kopiranja možeš prvo provjeriti git apply --check /putanja/do/kalora-kompaktni-makroi.patch, pa tek nakon uspjeha git apply /putanja/do/kalora-kompaktni-makroi.patch. Kopiranje i patch su alternative; ne primjenjuj oba.

Provjereno lokalno:217/217 osnovnih testova, TypeScript i produkcijski build. Na lokalnom produkcijskom buildu kroz Chromium potvrđene su sve3boje i prazne/50%/pune trakice, sve5boja teme, širine320/390/430/1280px bez horizontalnog prelijevanja te očuvani Klasični prikaz. UI koristi sintetičke račune i simulirane odgovore, bez produkcijskih poziva. SQL testovi nisu ponavljani jer je promijenjen samo CSS.

Aplikacija nije automatski objavljena. Spremanje na main povezan s Vercelom može pokrenuti produkcijsku objavu. Nakon buduće objave provjeri izgled na telefonu dok je online i ponovno otvori aplikaciju, bez brisanja podataka.
