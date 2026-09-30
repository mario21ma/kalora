import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata:Metadata={
 title:'Politika privatnosti · Kalora',
 description:'Kako Kalora obrađuje podatke povezane s dnevnikom prehrane, računom, AI funkcijama i barkod skenerom.'
};

const updated='29. rujna 2026.';

export default function PrivacyPage(){
 const supportEmail=process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
 return <main className="legal-page">
  <article className="legal-document">
   <div className="legal-brand">Kalora<span>•</span></div>
   <p className="eyebrow">PRIVATNOST I PODACI</p>
   <h1>Politika privatnosti</h1>
   <p className="legal-lead">Ova politika objašnjava koje podatke Kalora obrađuje, zašto ih koristi i koje mogućnosti imaš nad svojim podacima.</p>
   <p className="small-note">Zadnje ažuriranje: {updated}</p>

   <section><h2>1. Što je Kalora</h2><p>Kalora je dnevnik prehrane i wellness aplikacija za odrasle. Omogućuje praćenje hrane, kalorija, makronutrijenata, unosa vode, težine i osobnih ciljeva. Kalora nije medicinski proizvod i AI procjene nisu zamjena za stručni medicinski ili nutricionistički savjet.</p></section>

   <section><h2>2. Koje podatke obrađujemo</h2><ul>
    <li><b>Podaci računa:</b> e-mail adresa i podaci potrebni za prijavu kada izradiš Kalora račun.</li>
    <li><b>Profil i ciljevi:</b> ime ili nadimak, dob, spol za izračun, visina, težina, ciljana težina, razina aktivnosti, broj treninga i postavljeni kalorijski/makro ciljevi.</li>
    <li><b>Dnevnik:</b> unesena hrana, količine, nutritivne vrijednosti, dnevni unos vode, omiljeni obroci, dnevni ciljevi i zapisi težine.</li>
    <li><b>AI sadržaj:</b> tekst koji pošalješ funkciji „Procijeni s AI” ili AI razgovoru te relevantan kontekst dnevnika potreban za odgovor.</li>
    <li><b>Tehnički podaci:</b> nužni podaci zahtjeva i sigurnosni/operativni zapisi koje mogu obrađivati hosting i infrastrukturni pružatelji.</li>
   </ul></section>

   <section><h2>3. Kamera i barkod</h2><p>Kamera se koristi samo kada pokreneš skeniranje barkoda. Video slika kamere obrađuje se na uređaju radi prepoznavanja koda i Kalora ne sprema fotografije ni videosnimke. Nakon očitanja šalje se vrijednost barkoda radi pronalaska nutritivnih podataka proizvoda, primjerice u bazi Open Food Facts.</p></section>

   <section><h2>4. AI obrada</h2><p>Kada koristiš AI funkcije, sadržaj tvog upita i podaci potrebni za izvršenje zahtjeva šalju se Kalora poslužitelju, a zatim pružatelju AI usluge OpenAI. OpenAI API ključ nije pohranjen u aplikaciji na tvom uređaju. Ne šalji u AI unos podatke koji nisu potrebni za procjenu prehrane.</p></section>

   <section><h2>5. Gdje se podaci čuvaju</h2><p>Kalora koristi lokalnu pohranu preglednika/uređaja za radnu kopiju dnevnika i postavke. Kod prijavljenog računa podaci za sinkronizaciju mogu se čuvati i u Supabase infrastrukturi. Aplikacija se trenutačno poslužuje preko Vercela. Pojedini pružatelji mogu obrađivati tehničke zapise u skladu sa svojim uvjetima i pravilima privatnosti.</p></section>

   <section><h2>6. Zašto koristimo podatke</h2><ul>
    <li>za prikaz i spremanje tvog dnevnika prehrane i ciljeva;</li>
    <li>za sinkronizaciju podataka između tvojih uređaja kada koristiš račun;</li>
    <li>za procjenu nutritivnih vrijednosti i AI odgovore koje izričito zatražiš;</li>
    <li>za pronalazak proizvoda nakon skeniranja barkoda;</li>
    <li>za sigurnost, pouzdanost i otklanjanje tehničkih pogrešaka.</li>
   </ul><p>Kalora trenutačno ne koristi oglasne trackere i ne prodaje osobne podatke.</p></section>

   <section><h2>7. Zadržavanje i brisanje</h2><p>Podaci računa i cloud dnevnika čuvaju se dok koristiš račun ili dok ih ne izbrišeš. U aplikaciji možeš izvesti kopiju dnevnika, uređivati podatke te u <b>Profil → Račun i spremanje → Izbriši račun i podatke</b> pokrenuti trajno brisanje računa i podataka povezanih s njim. Lokalno izvezene sigurnosne kopije ostaju pod tvojom kontrolom.</p></section>

   <section><h2>8. Tvoja prava i kontrola</h2><p>U aplikaciji možeš pregledati i ispraviti većinu podataka, izvesti dnevnik te trajno izbrisati račun. Ako imaš dodatni zahtjev vezan uz pristup, ispravak, brisanje ili privatnost, obrati se izdavatelju Kalore.</p></section>

   <section><h2>9. Djeca</h2><p>Kalora je namijenjena osobama od 18 godina nadalje i onboarding ne prihvaća dob ispod 18 godina.</p></section>

   <section><h2>10. Kontakt</h2>{supportEmail?<p>Za pitanja o privatnosti: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>:<p>Za pitanja o privatnosti koristi kontakt podatke izdavatelja navedene na službenoj stranici ili App Store stranici Kalore. Prije javne objave izdavatelj treba postaviti <code>NEXT_PUBLIC_SUPPORT_EMAIL</code> kako bi kontakt bio prikazan i ovdje.</p>}</section>

   <section><h2>11. Promjene ove politike</h2><p>Politika se može ažurirati kada se promijene funkcije aplikacije, pružatelji usluga ili pravne obveze. Datum zadnje izmjene prikazan je na vrhu stranice.</p></section>

   <div className="legal-actions"><Link className="primary" href="/">Natrag u Kaloru</Link></div>
  </article>
 </main>;
}
