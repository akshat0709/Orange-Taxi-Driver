import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountStatus } from '../src/lib/accountStatus.ts';

const reply = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test('tells the app when no account exists for an email', async () => {
  assert.equal(await accountStatus('new@x.in', reply(200, { status: 'none' })), 'none');
  assert.equal(await accountStatus('a@x.in', reply(200, { status: 'exists' })), 'exists');
  assert.equal(await accountStatus('a@x.in', reply(429, { error: 'Too many' })), null);
  assert.equal(await accountStatus('a@x.in', (async () => { throw new Error('offline'); }) as unknown as typeof fetch), null);
});
