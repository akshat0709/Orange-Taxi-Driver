import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cashInHand, partnerLedger, paymentLabel } from '../src/lib/ledger.ts';

const rides = [
  { final_fare: 600, payment_method: 'cash' },
  { final_fare: 400, payment_method: 'driver_upi' },
  { final_fare: 1000, payment_method: 'upi_qr' },
  { final_fare: 500, payment_method: 'upi' },
];

test('UPI QR and online rides are not cash the driver holds', () => {
  assert.deepEqual(cashInHand(rides, [{ amount: 100 }]), { collected: 1000, handed: 100, holding: 900 });
});

test('commission ledger matches the website formula', () => {
  const l = partnerLedger(rides, [{ amount: 50, direction: 'driver_to_company' }], 15);
  // cash 1000 -> owes 150; online 1500 -> company owes 1275; paid 50
  assert.equal(l.commissionOnCash, 150);
  assert.equal(l.driverShareOnline, 1275);
  assert.equal(l.balance, 150 - 1275 - 50);
  assert.equal(l.driverEarnings, 2500 - 150 - 225);
  assert.equal(paymentLabel('upi_qr'), '🔳 UPI QR');
});
