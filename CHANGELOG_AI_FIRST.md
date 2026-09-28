# Kalora — AI-first izmjena

Ova verzija mijenja glavni unos hrane tako da korisnik više nije prisiljen ručno dodavati namirnicu ako je nema u lokalnom katalogu.

## Što je promijenjeno

- Glavni `+` unos sada je AI-first: tekst → AI procjena → pregled → spremanje.
- Prepoznatljiva hrana i jela koja nisu u katalogu dobivaju generičku AI procjenu kalorija i makronutrijenata na 100 g.
- `unknown` se koristi samo za tekst koji se stvarno ne može protumačiti kao hrana/količina.
- Ručni unos deklaracije ostaje skrivena, opcionalna funkcija za precizne komercijalne proizvode.
- AI procjene spremaju se kao lokalni cache kako bi se često korištene namirnice kasnije mogle ponovno koristiti.
- AI može raditi i s lokalnim dnevnikom bez Supabase prijave kada je `ALLOW_ANONYMOUS_AI=true`.
- AI chat za gosta dobiva samo odabrani dan, cilj, 7-dnevni sažetak i zadnjih 8 poruka.
- Dodavanje hrane iz AI chata automatski otvara nutritivnu procjenu.
- Ispravljeno je spremanje obroka: ako AI iz teksta prepozna ručak/večeru/doručak, taj meal type se više ne pregazi starim odabirom.
- Zadani model prebačen je na `gpt-6-luna` uz `OPENAI_REASONING_EFFORT=low`.
- Dodan je privremeni anonimni limit AI poziva po IP-u po instanci poslužitelja.

## Potrebno za AI

U `.env.local` postavi barem:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-6-luna
OPENAI_REASONING_EFFORT=low
ALLOW_ANONYMOUS_AI=true
```

API ključ ostaje isključivo na serveru.
