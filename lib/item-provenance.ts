import type {Item} from './domain';

export type NutritionSourceKind = 'ai' | 'generic' | 'open-food-facts' | 'manual' | 'unknown';
type ProvenanceItem = Pick<Item, 'isEstimate' | 'source' | 'foodId' | 'sourceUrls'>;

/** Quantity certainty and the origin of the nutrient values are independent. */
export function itemProvenance(item: ProvenanceItem) {
  const source = item.source.toLocaleLowerCase('hr-HR');
  let kind: NutritionSourceKind = 'unknown';
  if (source.startsWith('ai procjena') || source.startsWith('web provjerena') || item.foodId.startsWith('ai-')) kind = 'ai';
  else if (source.startsWith('open food facts')) kind = 'open-food-facts';
  else if (source.includes('deklaracija koju je unio korisnik') || source.includes('vlastita deklaracija')) kind = 'manual';
  else if (source.startsWith('generičk') || source.startsWith('generick')) kind = 'generic';

  const labels: Record<NutritionSourceKind, string> = {
    ai: 'AI procjena',
    generic: 'Generička procjena',
    'open-food-facts': 'Open Food Facts',
    manual: 'Vlastita deklaracija',
    unknown: 'Nepotvrđen izvor',
  };
  const notes: Record<NutritionSourceKind, string> = {
    ai: 'Nutritivne vrijednosti procijenio je AI; poveznica na izvor nije neovisna potvrda točnosti.',
    generic: 'Referentne vrijednosti mogu se razlikovati od tvoje namirnice i načina pripreme.',
    'open-food-facts': 'Podaci iz baze Open Food Facts. Usporedi ih s deklaracijom na pakiranju.',
    manual: 'Deklaracija koju je unio korisnik. Provjeri vrijednosti s pakiranja.',
    unknown: 'Podrijetlo nutritivnih vrijednosti nije potvrđeno. Provjeri deklaraciju.',
  };

  // Stored and imported diaries may predate current URL validation. Only render
  // actual HTTP(S) evidence; never infer a source from a product name or barcode.
  const seen = new Set<string>();
  const links: {url: string; hostname: string}[] = [];
  for (const raw of item.sourceUrls ?? []) {
    try {
      const url = new URL(raw);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || seen.has(url.href)) continue;
      seen.add(url.href);
      links.push({url: url.href, hostname: url.hostname.replace(/^www\./, '')});
    } catch { /* Invalid legacy evidence must not become an executable link. */ }
  }

  return {
    quantity: {kind: item.isEstimate ? 'estimate' as const : 'provided' as const, label: item.isEstimate ? 'Količina: procijenjena' : 'Količina: navedena'},
    data: {kind, label: labels[kind], note: notes[kind]},
    links,
  };
}
