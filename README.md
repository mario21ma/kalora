# Kalora — paketi za preuzimanje

## Najnovije: dorade za računalo

**[Preuzmi desktop ZIP](Kalora-desktop-dorade-2026-10-15.zip)** — 5 datoteka za zamjenu i 2 nove, za verziju main UI 6.5. U ZIP-u prvo pročitaj PRVO_PROCITAJ.md. Nema nove SQL migracije.

Širi dnevnik, voda i tjedni pregled desno, jasniji redovi hrane te unos i provjera obroka u dva stupca. Mobilni prikaz i izbor Klasični/Kompaktni ostaju. Desktop raspored uključuje se automatski prema širini prozora. Nema dodatnih AI poziva.

- [Kratke upute](DESKTOP_UPUTE.md)
- [Stvarni desktop: Kompaktni](Kalora-desktop-kompaktni.png) · [Klasični](Kalora-desktop-klasicni.png)
- [Stvarni unos hrane](Kalora-desktop-unos.png) · [Mobilni Kompaktni](Kalora-mobitel-kompaktni.png)
- [Opis izmjena i lokalnih provjera](DESKTOP_DORADE_2026-10-15.md)

Prošlo: 217 osnovnih, 7 lokalnih SQL i 53 preglednička testa, TypeScript i produkcijski build. Fizički telefon i produkcijske usluge još trebaju ručnu provjeru. Aplikacija nije automatski objavljena.

## Prethodna mala dorada: boje i trakice makronutrijenata

**[Preuzmi nadogradnju makroa](Kalora-kompaktni-makroi-2026-10-15.zip)** — zamjenjuje se samo `app/globals.css`, nakon prethodnog paketa novog izgleda.

Proteini zeleni, ugljikohidrati plavi, masti narančaste, uz trakice prema dnevnom cilju. [Stvarni prikaz](Kalora-kompaktni-makroi.png) · [Upute](MAKROI_UPUTE.md). SQL nije potreban; aplikacija nije automatski objavljena.

## Prethodni cjeloviti paket: novi izgled i unos hrane

**[Preuzmi novi programski ZIP](Kalora-novi-izgled-2026-10-15.zip)** — 10 datoteka za zamjenu i 8 novih. U ZIP-u prvo pročitaj PRVO_PROCITAJ.md. SQL ne treba ponovno pokretati.

Novi raspored uključuješ kroz **Profil → Izgled aplikacije → Kompaktni → Spremi izgled**. Klasični ostaje zadani; nijedan korisnički unos nije potrebno brisati.

- [Kratke upute](PREUZIMANJE_NOVI_IZGLED.md)
- [Stvarni novi ekran lokalnog produkcijskog builda](Kalora-kompaktni-stvarni-prikaz.png)
- [Opis izmjena, provjera i primjene](IZGLED_I_UNOS_2026-10-15.md)

Prošlo: 217 osnovnih, 7 SQL, 44 u punom pregledničkom prolazu + 1 dodatna regresija malog ekrana, TypeScript i produkcijski build. Stvarni mobilni uređaj i stvarne cloud usluge još trebaju ručnu provjeru. Aplikacija nije automatski objavljena.

## Raniji paket beta popravaka

[ZIP prethodnih potvrđenih beta popravaka](Kalora-zadnji-popravci-2026-10-15.zip).

## Vizualni koncepti prije implementacije

- [Klasični i Kompaktni — koncept](Kalora-klasicni-i-kompaktni.png)
- [Unos i postavke — koncept](Kalora-unos-i-postavke.png)
- [Obrazloženje prijedloga](PRIJEDLOG_UNAPRJEDENJA.md)

Ova grana služi preuzimanju paketa i dokumenata. Nije aplikacijska ni produkcijska grana. Prijenos u povezani main može pokrenuti Vercel; prvo provjeri izmjene na odvojenoj grani, a za hosted Preview s promjenama podataka koristi odvojenu testnu bazu.