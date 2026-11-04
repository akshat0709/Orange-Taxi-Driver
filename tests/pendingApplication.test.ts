import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPendingApplication,
  insertApplication,
  savePendingApplication,
  submitPendingApplication,
} from '../src/lib/pendingApplication.ts';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => void m.set(k, v),
    removeItem: async (k: string) => void m.delete(k),
  };
}
function fakeDb(rejectFull = false, rejectAll = false) {
  const rows: Record<string, unknown>[] = [];
  return {
    rows,
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        if (rejectAll || (rejectFull && 'photo_url' in row)) return { error: { message: 'rejected' } };
        rows.push(row);
        return { error: null };
      },
    }),
  };
}
const row = { email: 'Ravi@Example.com', full_name: 'Ravi', photo_url: 'storage://x', status: 'new' };

test('nothing reaches the admin until the verified driver submits it, and only once', async () => {
  const s = memoryStorage();
  const db = fakeDb();
  await savePendingApplication(s, 'Ravi@Example.com', row);
  assert.equal(db.rows.length, 0);
  assert.equal(await submitPendingApplication(s, db, ' ravi@example.com '), 'sent');
  assert.equal(db.rows.length, 1);
  assert.equal(await submitPendingApplication(s, db, 'ravi@example.com'), 'none');
  assert.equal(db.rows.length, 1);
});

test("another email's saved application is never sent", async () => {
  const s = memoryStorage();
  const db = fakeDb();
  await savePendingApplication(s, 'ravi@example.com', row);
  assert.equal(await submitPendingApplication(s, db, 'someone@else.com'), 'none');
  assert.equal(db.rows.length, 0);
  assert.ok(await getPendingApplication(s, 'ravi@example.com'));
});

test('a failed insert keeps the application for the next sign-in', async () => {
  const s = memoryStorage();
  await savePendingApplication(s, 'ravi@example.com', row);
  assert.equal(await submitPendingApplication(s, fakeDb(false, true), 'ravi@example.com'), 'rejected');
  assert.ok(await getPendingApplication(s, 'ravi@example.com'));
});

test('falls back to the base columns', async () => {
  const db = fakeDb(true);
  assert.equal(await insertApplication(db, row), null);
  assert.deepEqual(db.rows[0], { email: 'Ravi@Example.com', full_name: 'Ravi', status: 'new' });
});
