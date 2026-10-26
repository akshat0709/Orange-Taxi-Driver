import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMissingRpcError, isNetworkError, REPLAYABLE_FROM_STATUSES } from '../src/lib/supabaseErrors.ts';

test('isMissingRpcError only matches "function not deployed" errors', () => {
  assert.equal(isMissingRpcError({ code: 'PGRST202', message: 'Could not find the function public.accept_booking' }), true);
  assert.equal(isMissingRpcError({ code: '42883', message: 'function does not exist' }), true);
  assert.equal(isMissingRpcError(null), false);
});

test('regression: a server rejection from accept_booking does not trigger the fallback', () => {
  // e.g. RAISE EXCEPTION 'driver not approved' -> P0001
  assert.equal(isMissingRpcError({ code: 'P0001', message: 'Driver is not approved' }), false);
  assert.equal(isMissingRpcError({ code: '42501', message: 'permission denied' }), false);
});

test('isNetworkError distinguishes fetch failures from database errors', () => {
  assert.equal(isNetworkError({ message: 'TypeError: Network request failed' }), true);
  assert.equal(isNetworkError({ code: '', message: 'Failed to fetch' }), true);
  assert.equal(isNetworkError({ code: '42501', message: 'new row violates row-level security policy' }), false);
  assert.equal(isNetworkError({ code: 'PGRST116', message: 'network' }), false);
  assert.equal(isNetworkError(null), false);
});

test('regression: queued updates may not overwrite cancelled or completed bookings', () => {
  assert.ok(!REPLAYABLE_FROM_STATUSES.includes('cancelled' as any));
  assert.ok(!REPLAYABLE_FROM_STATUSES.includes('completed' as any));
  assert.ok(REPLAYABLE_FROM_STATUSES.includes('in_progress'));
});
