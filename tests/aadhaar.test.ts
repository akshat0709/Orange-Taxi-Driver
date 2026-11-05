import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aadhaarDigits, aadhaarHint, formatAadhaar, isValidAadhaar, maskAadhaar } from '../src/lib/aadhaar.ts';

test('typing digit by digit keeps every digit', () => {
  let state = '';
  for (const ch of '234123412346') state = aadhaarDigits(formatAadhaar(state) + ch);
  assert.equal(state, '234123412346');
  assert.equal(formatAadhaar(state), '2341 2341 2346');
});

test('deleting and pasting work', () => {
  assert.equal(aadhaarDigits('2341 2341 234'), '23412341234');
  assert.equal(aadhaarDigits('2341-2341-2346 extra 99'), '234123412346');
  assert.equal(formatAadhaar('23412'), '2341 2');
});

test('checksum, length and first digit are validated', () => {
  assert.equal(isValidAadhaar('234123412346'), true);
  assert.equal(isValidAadhaar('234123412347'), false);
  assert.equal(isValidAadhaar('23412341234'), false);
  assert.equal(isValidAadhaar('123412341234'), false);
});

test('only the last four digits are saved', () => {
  assert.equal(maskAadhaar('234123412346'), 'XXXX-XXXX-2346');
});

test('digits typed on Hindi / Marathi / Bengali keyboards are kept', () => {
  assert.equal(aadhaarDigits('२३४१ २३४१ २३४६'), '234123412346');
  assert.equal(aadhaarDigits('২৩৪১২৩৪১২৩৪৬'), '234123412346');
  assert.equal(aadhaarDigits('２３４１'), '2341'); // full-width
  assert.equal(aadhaarDigits('Aadhaar: 2341 2341 2346'), '234123412346'); // pasted with text
});

test('hint explains what is wrong once 12 digits are in', () => {
  assert.equal(aadhaarHint('23412341'), null);
  assert.equal(aadhaarHint('234123412346'), null);
  assert.match(aadhaarHint('123412341234') ?? '', /never start with 0 or 1/);
  assert.match(aadhaarHint('234123412345') ?? '', /doesn't match a real Aadhaar/);
});
