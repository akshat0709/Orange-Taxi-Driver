import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexCell, pickupHexColumns } from '../src/lib/hexGrid.ts';

test('a point gets a resolution-7 hexagon; bad positions get none', () => {
  assert.match(hexCell(12.9716, 77.5946) ?? '', /^87[0-9a-f]{13}$/);
  assert.equal(hexCell(null, 77.5), null);
  assert.equal(hexCell(Number.NaN, 77.5), null);
  assert.equal(hexCell(95, 77.5), null);
});

test('a booking saves the pickup hexagon and the 61-hexagon ring around it', () => {
  const c = pickupHexColumns(12.9716, 77.5946);
  assert.equal(c.pickup_h3_ring?.length, 61);
  assert.ok(c.pickup_h3_ring?.includes(c.pickup_h3_r7!));
  assert.deepEqual(pickupHexColumns(undefined, undefined), {});
});

test('a driver 3 km away is inside the ring; one 15 km away is not', () => {
  const ring = pickupHexColumns(12.9716, 77.5946).pickup_h3_ring!;
  assert.ok(ring.includes(hexCell(12.9986, 77.5946)!));
  assert.ok(!ring.includes(hexCell(13.1066, 77.5946)!));
});
