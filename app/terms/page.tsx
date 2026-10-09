import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata:Metadata={
 title:'Uvjeti korištenja · Kalora',
 description:'Uvjeti korištenja Kalore, dnevnika prehrane i osobnih ciljeva.'
};

export default function TermsPage(){
 const supportEmail=process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
 return <main className="legal-page">
  <article className="legal-document">
   <div className="legal-brand">Kalora<span>•</span></div>
   <p className="eyebrow">O APLIKACIJI I KORIŠTENJU</p>
   <h1>Uvjeti korištenja</h1>
   <p className="legal-lead">Ovi uvjeti opisuju korištenje Kalore, osobnog dnevnika prehrane i wellness aplikacije za odrasle.</p>
   <p className="small-note">Zadnje ažuriranje: 9. listopada 2026.</p>

   <section><h2>1. Aplikacija i izdavatelj</h2><p>Kaloru razvija Mario Pučić kao projekt individualnog razvijatelja. Trenutačno je dostupna kao web/PWA aplikacija u razvojnoj i pilot fazi. Objava u trgovinama aplikacija i komercijalna distribucija još nisu odlučene.</p><p>Kalora omogućuje bilježenje hrane, kalorija, makronutrijenata, vode, težine i osobnih ciljeva te pregled prethodnih zapisa.</p></section>

   <section><h2>2. Namjena i dob korisnika</h2><p>Kalora je namijenjena osobama od 18 godina nadalje za osobno praćenje prehrane i navika. Nije namijenjena dijagnosticiranju ili liječenju bolesti. Izračuni, nutritivni podaci i AI odgovori informativne su procjene i mogu sadržavati pogreške.</p><p>Za odluke povezane sa zdravstvenim stanjem, terapijom ili posebnom prehranom obrati se odgovarajućem stručnjaku. Ne mijenjaj terapiju na temelju podataka iz aplikacije.</p></section>

   <section><h2>3. Račun i odgovorno korištenje</h2><p>Za funkcije koje zahtijevaju prijavu koristi vlastiti račun i čuvaj pristupne podatke. Unosi podatke koje smiješ koristiti i provjeri njihove vrijednosti prije spremanja.</p><p>Nije dopušteno pokušavati pristupiti tuđim računima ili podacima, ometati rad usluge, zaobilaziti sigurnosne mjere ili zloupotrebljavati AI funkcije i ograničenja zahtjeva.</p></section>

   <section><h2>4. Nutritivni podaci, barkod i AI</h2><p>Podaci o hrani mogu dolaziti iz korisničkog unosa, baza proizvoda i AI procjena. Recepti, deklaracije, veličine porcija i način pripreme mogu se razlikovati. Provjeri podatke prema deklaraciji proizvoda i po potrebi ih ispravi.</p><p>Za skeniranje barkoda potrebno je dopuštenje za kameru. AI procjene i dohvat proizvoda zahtijevaju internetsku vezu. Na AI obradu primjenjuju se informacije navedene u politici privatnosti.</p></section>

   <section><h2>5. Spremanje i dostupnost</h2><p>Kalora koristi lokalnu pohranu uređaja, a za prijavljene korisnike može koristiti i sinkronizaciju s oblakom. Dio funkcija dostupan je bez interneta nakon prethodnog učitavanja aplikacije. Prijava, AI i sinkronizacija trebaju internetsku vezu.</p><p>U razvojnoj fazi mogući su prekidi, pogreške i promjene funkcija. Brisanje podataka preglednika ili promjena uređaja može utjecati na lokalne zapise. Za važne zapise redovito izvezi sigurnosnu kopiju dnevnika.</p></section>

   <section><h2>6. Planirano povezivanje s Huawei Health</h2><p>Povezivanje s Huawei Health trenutačno je planirana funkcija i još nije dostupno. Predviđen je dobrovoljan pristup samo broju koraka i potrošenim kalorijama, nakon korisnikova odobrenja. Nije planirano zapisivanje podataka u Huawei Health.</p><p>Prije omogućavanja povezivanja bit će objavljena pravila o obradi tih podataka, načinu povezivanja, povlačenju odobrenja i brisanju uvezenih podataka. Ovi uvjeti sami po sebi ne predstavljaju odobrenje za pristup Huawei podacima.</p></section>

   <section><h2>7. Privatnost i kontrola podataka</h2><p>Obrada osobnih podataka opisana je u <Link href="/privacy">Politici privatnosti</Link>. U aplikaciji možeš uređivati svoje zapise i izvesti dnevnik. Za prijavljeni račun dostupno je brisanje računa i povezanih podataka kroz odjeljak za račun u profilu. Sigurnosne kopije koje si preuzeo ostaju pod tvojom kontrolom.</p></section>

   <section><h2>8. Promjene i buduća distribucija</h2><p>Funkcije i ovi uvjeti mogu se mijenjati tijekom razvoja. Datum posljednje izmjene prikazan je na vrhu stranice. O bitnim promjenama koje utječu na korištenje ili obradu podataka korisnici će biti obaviješteni prije njihove primjene.</p><p>Ovi uvjeti ne uvode naknadu ni pretplatu. Ako se uvedu plaćene funkcije, njihove cijene i uvjeti bit će predstavljeni zasebno prije kupnje. Ovi uvjeti ne ograničavaju prava koja korisniku pripadaju prema primjenjivim propisima.</p></section>

   {supportEmail&&<section><h2>9. Kontakt</h2><p>Za pitanja o korištenju Kalore obrati se izdavatelju na <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p></section>}

   <p><Link href="/privacy">Politika privatnosti</Link></p>
   <div className="legal-actions"><Link className="primary" href="/">Natrag u Kaloru</Link></div>
  </article>
 </main>;
}
