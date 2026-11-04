import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptErrorMessage,
  demandHintText,
  fetchRideOffers,
  navigateUrl,
  pickOffer,
  pickupEtaLabel,
  secondsLeft,
  type RideOffer,
} from '../src/lib/rideOffers.ts';

const NOW = Date.parse('2026-11-04T18:00:00Z');
const at = (s: number) => new Date(NOW + s * 1000).toISOString();

test('older server without offers keeps the old behaviour', async () => {
  const missing = { rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.my_ride_offers' } }) };
  assert.deepEqual(await fetchRideOffers(missing), { supported: false, offers: [] });
  const flaky = { rpc: async () => ({ data: null, error: { message: 'Failed to fetch' } }) };
  assert.deepEqual(await fetchRideOffers(flaky), { supported: true, offers: [] });
  const ok = { rpc: async () => ({ data: [{ booking_id: 'b1', expires_at: at(15), eta_seconds: 240, is_open: false }], error: null }) };
  assert.equal((await fetchRideOffers(ok)).offers.length, 1);
});

test('personal offers come before open rides; expired and declined ones are skipped', () => {
  const offers: RideOffer[] = [
    { booking_id: 'open', expires_at: null, eta_seconds: null, is_open: true },
    { booking_id: 'later', expires_at: at(18), eta_seconds: 300, is_open: false },
    { booking_id: 'soon', expires_at: at(6), eta_seconds: 200, is_open: false },
    { booking_id: 'gone', expires_at: at(0.5), eta_seconds: 100, is_open: false },
  ];
  assert.equal(pickOffer(offers, () => false, NOW)?.booking_id, 'soon');
  assert.equal(pickOffer(offers, (id) => id === 'soon', NOW)?.booking_id, 'later');
  assert.equal(pickOffer(offers, (id) => id !== 'open', NOW)?.booking_id, 'open');
  assert.equal(pickOffer([], () => false, NOW), null);
});

test('countdown and labels', () => {
  assert.equal(secondsLeft(at(12.4), NOW), 12);
  assert.equal(secondsLeft(at(90), NOW), 20); // phone clock behind: capped
  assert.equal(secondsLeft(at(-5), NOW), 0);
  assert.equal(secondsLeft(null, NOW), 30);
  assert.equal(pickupEtaLabel(250), '4 min to pickup');
  assert.equal(pickupEtaLabel(20), '1 min to pickup');
  assert.equal(pickupEtaLabel(null), null);
  assert.equal(acceptErrorMessage('This ride is being offered to other chauffeurs first.').title, 'Offered to closer chauffeurs');
  assert.equal(acceptErrorMessage('Ride already claimed by another chauffeur').title, 'Ride already claimed');
});

test('demand hint text and navigation link', () => {
  const h = { area: 'Indiranagar', lat: 12.978, lng: 77.64, distance_km: 5, riders: 3, free_chauffeurs: 1 };
  assert.equal(demandHintText(h), '3 riders looked for a cab in Indiranagar in the last hour, only 1 free chauffeur there · 5 km away');
  assert.match(demandHintText({ ...h, riders: 1, free_chauffeurs: 0 }), /^1 rider looked .* no free chauffeurs there/);
  assert.equal(navigateUrl(h), 'https://www.google.com/maps/dir/?api=1&destination=12.978,77.64&travelmode=driving');
});
