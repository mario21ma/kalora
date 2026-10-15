import test from 'node:test';
import assert from 'node:assert/strict';
import {itemProvenance} from '../lib/item-provenance.ts';

const item = (changes = {}) => ({foodId: 'ai-example', source: 'AI procjena nutritivnih vrijednosti; nije provjereno', isEstimate: true, ...changes});

test('a provided quantity never turns AI nutrition into verified data', () => {
  const estimated = itemProvenance(item());
  const provided = itemProvenance(item({isEstimate: false}));
  assert.equal(estimated.quantity.kind, 'estimate');
  assert.equal(provided.quantity.kind, 'provided');
  assert.equal(provided.quantity.label, 'Količina: navedena');
  assert.deepEqual(provided.data, estimated.data);
  assert.equal(provided.data.kind, 'ai');
  assert.match(provided.data.note, /nije neovisna potvrda/);
});

test('legacy Web provjerena AI records retain an honest estimate label without changing stored source', () => {
  const legacy = item({foodId: 'legacy-id', source: 'Web provjerena deklaracija', isEstimate: false});
  const original = structuredClone(legacy);
  assert.equal(itemProvenance(legacy).data.kind, 'ai');
  assert.equal(itemProvenance(legacy).data.label, 'AI procjena');
  assert.deepEqual(legacy, original);
});

test('Open Food Facts and user declarations show their origin without an independent verification claim', () => {
  const off = itemProvenance(item({foodId: 'barcode-123', source: 'Open Food Facts · 123'}));
  assert.equal(off.data.kind, 'open-food-facts');
  assert.equal(off.quantity.kind, 'estimate');
  assert.match(off.data.note, /Usporedi.*deklaracijom/);
  const manual = itemProvenance(item({foodId: 'own-food', source: 'Deklaracija koju je unio korisnik', isEstimate: false}));
  assert.equal(manual.data.kind, 'manual');
  assert.equal(manual.data.label, 'Vlastita deklaracija');
  assert.match(manual.data.note, /unio korisnik/);
  assert.equal(manual.quantity.kind, 'provided');
});

test('generic references and unknown legacy sources remain distinct', () => {
  assert.equal(itemProvenance(item({foodId: 'banana', source: 'Generička referentna procjena; provjerite deklaraciju'})).data.kind, 'generic');
  assert.equal(itemProvenance(item({foodId: 'pepper', source: 'Generički recept; ovisi o mesu, riži i umaku'})).data.kind, 'generic');
  const unknown = itemProvenance(item({foodId: 'legacy', source: 'Raniji proizvod'}));
  assert.equal(unknown.data.kind, 'unknown');
  assert.equal(unknown.data.label, 'Nepotvrđen izvor');
  assert.deepEqual(unknown.links, []);
});

test('only retained HTTP(S) evidence becomes a source link and links do not change certainty', () => {
  const evidence = item({isEstimate: false, sourceUrls: ['https://www.example.com/label', 'https://www.example.com/label', 'javascript:alert(1)', 'data:text/html,a', 'ftp://example.com/a', 'invalid', 'https://name:secret@example.com/private', 'http://other.example.com/info']});
  const provenance = itemProvenance(evidence);
  assert.deepEqual(provenance.links, [{url: 'https://www.example.com/label', hostname: 'example.com'}, {url: 'http://other.example.com/info', hostname: 'other.example.com'}]);
  assert.equal(provenance.data.kind, 'ai');
  assert.equal(provenance.quantity.kind, 'provided');
  assert.deepEqual(itemProvenance(item()).links, []);
});
