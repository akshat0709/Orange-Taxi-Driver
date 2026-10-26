import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRideQr, getQrStatus, WEB_API_URL } from '../src/lib/upiQr.ts';

const ok = (body: unknown, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });

test('creates a ride QR on the website server with the driver session', async () => {
  let seen: { url: string; init: any } | null = null;
  const qr = await createRideQr('b1', 'tok', async (url, init) => {
    seen = { url, init };
    return ok({ ok: true, qr: { id: 'qr_1', amount: 250, status: 'pending', image_url: 'x' } })();
  });
  assert.equal(qr.id, 'qr_1');
  assert.equal(seen!.url, `${WEB_API_URL}/api/qr/ride`);
  assert.equal(seen!.init.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(seen!.init.body), { bookingId: 'b1' });
});

test('surfaces the server error message', async () => {
  await assert.rejects(getQrStatus('qr_1', 'tok', ok({ ok: false, error: 'Not your QR code.' }, 403)), /Not your QR code/);
});
