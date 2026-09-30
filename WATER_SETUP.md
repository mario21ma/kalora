# Kalora — voda + siluete

1. Zamijeni datoteke iz patcha u projektu.
2. U Supabase Dashboardu otvori **SQL Editor**.
3. Otvori `supabase/water_migration.sql`, kopiraj cijeli sadržaj i pokreni **Run** samo jednom.
4. Lokalno pokreni `pnpm build`.
5. Ako build prođe: `git add .`, commit i `git push`.

Dnevni cilj vode računa se automatski kao približno **35 ml/kg**, zaokruženo na najbližih 250 ml (raspon 1,5–6,0 L). Za odabrani datum koristi se najnoviji zapis težine do tog datuma, a ako ga nema, težina iz profila.

Klik na 100 / 250 / 330 / 500 ml odmah označava stanje kao promijenjeno i pokreće cloud sync. Voda se sprema po danu u `daily_water` i sinkronizira između uređaja kroz postojeći `save_diary` / `load_diary` mehanizam.
