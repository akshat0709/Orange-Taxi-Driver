import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIndianMobile,
  matchLegacyDriverByVerifiedPhone,
  resolveDriverRowForUser,
} from '../src/lib/driverIdentity.ts';

// --- Minimal fake of the supabase query builder used by resolveDriverRowForUser -------------
type Row = Record<string, any>;
function fakeClient(rows: Row[]) {
  const updates: Array<{ id: string; patch: Row }> = [];
  const from = (_table: string) => {
    const filters: Array<(r: Row) => boolean> = [];
    let patch: Row | null = null;
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: any) => (filters.push((r) => r[col] === val), builder),
      is: (col: string, val: any) => (filters.push((r) => (r[col] ?? null) === val), builder),
      limit: () => builder,
      update: (p: Row) => ((patch = p), builder),
      maybeSingle: async () => {
        const hits = rows.filter((r) => filters.every((f) => f(r)));
        if (patch) {
          if (hits.length !== 1) return { data: null, error: null };
          Object.assign(hits[0], patch);
          updates.push({ id: hits[0].id, patch });
          return { data: { ...hits[0] }, error: null };
        }
        return { data: hits[0] ? { ...hits[0] } : null, error: null };
      },
      then: (resolve: any) =>
        resolve({ data: rows.filter((r) => filters.every((f) => f(r))).map((r) => ({ ...r })), error: null }),
    };
    return builder;
  };
  return { client: { from }, rows, updates };
}

test('normalizeIndianMobile keeps the last 10 digits and rejects short input', () => {
  assert.equal(normalizeIndianMobile('+91 98765 43210'), '9876543210');
  assert.equal(normalizeIndianMobile('09876543210'), '9876543210');
  assert.equal(normalizeIndianMobile('12345'), null);
  assert.equal(normalizeIndianMobile('+'), null);
  assert.equal(normalizeIndianMobile(''), null);
});

test('regression: a phone with no digits no longer matches every driver', () => {
  const rows = [{ id: 'd1', phone: '9876543210', user_id: null }];
  // Old code: digits.slice(-10) === '' and "x".endsWith('') is true for every row.
  assert.equal(matchLegacyDriverByVerifiedPhone(rows, '+'), null);
});

test('legacy match requires an exact, unique, unlinked row', () => {
  const rows = [
    { id: 'd1', phone: '+91 98765 43210', user_id: null },
    { id: 'd2', phone: '9876500000', user_id: 'someone' },
    { id: 'd3', phone: '1119876543210', user_id: null }, // same last-10 digits as d1 -> ambiguous
  ];
  assert.equal(matchLegacyDriverByVerifiedPhone(rows, '9876543210'), null);
  assert.equal(matchLegacyDriverByVerifiedPhone(rows.slice(0, 2), '9876543210')?.id, 'd1');
  assert.equal(matchLegacyDriverByVerifiedPhone(rows, '9876500000'), null); // already linked
});

test('normal path: row linked by user_id is returned without any update', async () => {
  const { client, updates } = fakeClient([{ id: 'd1', user_id: 'u1', phone: '9876543210' }]);
  const row = await resolveDriverRowForUser(client, { id: 'u1' });
  assert.equal(row?.id, 'd1');
  assert.equal(updates.length, 0);
});

test('regression: unverified user_metadata.phone cannot claim another chauffeur', async () => {
  const { client, rows, updates } = fakeClient([{ id: 'victim', user_id: null, phone: '+91 98765 43210' }]);
  const row = await resolveDriverRowForUser(client, {
    id: 'attacker',
    phone: null, // not verified by Supabase
    user_metadata: { phone: '9876543210' }, // typed in at sign-up
  });
  assert.equal(row, null);
  assert.equal(updates.length, 0);
  assert.equal(rows[0].user_id, null);
});

test('regression: an already-linked chauffeur row is never re-assigned', async () => {
  const { client, rows, updates } = fakeClient([{ id: 'victim', user_id: 'victim-user', phone: '9876543210' }]);
  const row = await resolveDriverRowForUser(client, { id: 'attacker', phone: '+919876543210' });
  assert.equal(row, null);
  assert.equal(updates.length, 0);
  assert.equal(rows[0].user_id, 'victim-user');
});

test('legacy unlinked row is linked via the auth-verified phone', async () => {
  const { client, rows } = fakeClient([{ id: 'legacy', user_id: null, phone: '+91 98765 43210' }]);
  const row = await resolveDriverRowForUser(client, { id: 'u9', phone: '919876543210' });
  assert.equal(row?.id, 'legacy');
  assert.equal(rows[0].user_id, 'u9');
});
