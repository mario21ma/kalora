import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuantityDraft} from '../lib/quantity.ts';

test('preview quantities reject invalid visible text instead of saving the previous quantity', () => {
  for (const text of ['', ' ', '0', '-1', 'abc', 'NaN', 'Infinity', '5001', '999999', '1e3', '1,2.3']) {
    assert.equal(parseQuantityDraft(text), null, text);
  }
});

test('valid visible quantities preserve decimal grams and millilitres', () => {
  for (const [text, expected] of [['120',120], ['120,5',120.5], ['0.5',0.5], ['330',330], ['5000',5000], [' 1,25 ',1.25]]) {
    assert.equal(parseQuantityDraft(text), expected, text);
  }
});
