# Kalora — iOS / Capacitor priprema

Projekt je pripremljen za Capacitor 8.5.2. Trenutna arhitektura Kalore koristi Next.js API rute na Vercelu, pa native shell za sada otvara produkcijsku HTTPS verziju aplikacije preko `CAPACITOR_SERVER_URL` (zadano `https://kalora-1fjs.vercel.app`). Ovo je dobar korak za testiranje u Xcodeu/TestFlightu, ali prije konačne App Store prijave treba odlučiti želimo li zadržati remote-shell pristup ili odvojiti statički frontend od Vercel API-ja i bundleati frontend lokalno.

## Na Macu

1. Instaliraj ovisnosti: `pnpm install`
2. Dodaj iOS projekt: `pnpm ios:add`
3. U `ios/App/App/Info.plist` dodaj sadržaj iz `native/ios/Info.plist.snippet.xml`.
4. Kopiraj `native/ios/PrivacyInfo.xcprivacy` u Xcode projekt/target ako ga generated projekt već nema. Ako generated Capacitor/SDK manifesti već prijavljuju korištene Required Reason API-je, nemoj ih naslijepo prepisati ovim praznim predloškom — spoji ih.
5. Sinkroniziraj: `pnpm ios:sync`
6. Otvori Xcode: `pnpm ios:open`
7. U Xcodeu postavi Team, Signing i jedinstveni Bundle Identifier ako `com.kalora.app` nije dostupan.
8. Testiraj kameru/barkod, login, AI, cloud sync i brisanje računa na stvarnom iPhoneu.

## Važno

- Za razvojnu/produkcijsku URL adresu možeš postaviti `CAPACITOR_SERVER_URL` prije `cap sync`.
- iOS projekt (`ios/`) treba generirati na Macu jer je za završni build potreban Xcode.
- Ovaj paket ne tvrdi da je remote-server Capacitor shell već konačna App Store arhitektura. Apple review treba testirati kroz TestFlight prije slanja.
