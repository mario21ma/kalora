# Kalora — paketi za preuzimanje

## Najnovije: novi izgled i unos hrane

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
