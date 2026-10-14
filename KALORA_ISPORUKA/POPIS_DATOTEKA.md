# Točan popis datoteka

Paket je izrađen prema projektu mario21ma/kalora, polazni commit 393e0a43a1452b7e2226a78b4933b7c661942164.

Putanje su relativne u odnosu na korijen postojećeg projekta. Datoteke su spremne u mapi projekt/ ovog paketa. Zadržavaj postojeće mape; zamijeni njihove navedene datoteke i dodaj nove.

## Zamijeni — 21 postojeća datoteka

- .env.example
- README_HR.md
- app/api/analyze/route.ts
- app/api/chat/route.ts
- app/page.tsx
- app/privacy/page.tsx
- components/profile.tsx
- lib/ai-server.ts
- lib/cloud.ts
- lib/domain.ts
- lib/off-product.ts
- lib/use-diary.ts
- package-lock.json
- package.json
- pnpm-lock.yaml
- public/sw.js
- tests/database.test.mjs
- tests/domain.test.mjs
- tests/session.test.mjs
- tsconfig.json
- vercel.json

## Dodaj — 16 novih datoteka

- BETA_FIXES.md
- lib/barcode-scanner.ts
- lib/diary-storage.ts
- lib/diary-store.ts
- lib/quantity.ts
- lib/undo.ts
- supabase/ai_quota_account_cleanup.sql
- tests/account-deletion-database.test.mjs
- tests/ai-input.test.mjs
- tests/browser-regressions.mjs
- tests/diary-store.test.mjs
- tests/pwa-deploy.test.mjs
- tests/quantity.test.mjs
- tests/scanner.test.mjs
- tests/support/browser-harness.mjs
- tests/undo.test.mjs

## Pomoćne datoteke paketa

- sql_preduvjeti/: neizmijenjene postojeće SQL migracije, priložene radi lakšeg izvršavanja. Ne treba dodavati tu mapu u aplikaciju.
- PROVJERA_BAZE.sql: upiti samo za čitanje, prije i nakon SQL migracija.
- kalora-beta-popravci.patch: alternativa ručnom kopiranju, za Git korisnike.
- MANIFEST_SHA256.json: hash svake datoteke i očekivane polazne verzije.
- UPUTE_ZA_ZAMJENU.md: redoslijed instalacije i produkcijskih provjera.

.env.example je samo predložak. Paket ne sadrži .env.local, stvarne ključeve, .git, node_modules ili .next.
