// Same rules as the website (src/lib/driver-type.ts): what a driver and Orange Taxi owe each other.
// Pure; unit-tested.

type RideLike = { final_fare?: unknown; estimated_fare?: unknown; payment_method?: string | null };
type SettlementLike = { amount?: unknown; direction?: string | null };

/** Money the driver collected themselves (cash or their own UPI). QR / online / wallet rides went
 * to Orange Taxi and are never cash the driver holds. */
const DRIVER_COLLECTED = new Set(['cash', 'driver_upi']);

export const fareOf = (r: RideLike) => Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)) || 0;

export function isDriverCollected(method?: string | null) {
  return DRIVER_COLLECTED.has(String(method || 'cash'));
}

/** Company driver: cash in hand = cash collected on completed rides - cash handed in. */
export function cashInHand(rides: RideLike[], handedIn: Array<{ amount?: unknown }>) {
  const collected = rides.filter((r) => isDriverCollected(r.payment_method)).reduce((s, r) => s + fareOf(r), 0);
  const handed = handedIn.reduce((s, x) => s + (Math.round(Number(x.amount)) || 0), 0);
  return { collected, handed, holding: Math.max(0, collected - handed) };
}

export interface PartnerLedger {
  cashFare: number;
  onlineFare: number;
  commissionPct: number;
  commissionOnCash: number;
  driverShareOnline: number;
  driverEarnings: number;
  paidByDriver: number;
  paidToDriver: number;
  /** > 0: the driver owes Orange Taxi this much. < 0: Orange Taxi owes the driver. */
  balance: number;
}

/** Commission driver: commission on cash rides vs the driver's share of online rides. */
export function partnerLedger(rides: RideLike[], settlements: SettlementLike[], commissionPct: number): PartnerLedger {
  const pct = Math.max(0, Number(commissionPct) || 0) / 100;
  let cashFare = 0;
  let onlineFare = 0;
  for (const r of rides) {
    if (isDriverCollected(r.payment_method)) cashFare += fareOf(r);
    else onlineFare += fareOf(r);
  }
  const commissionOnCash = Math.round(cashFare * pct);
  const commissionOnOnline = Math.round(onlineFare * pct);
  const driverShareOnline = onlineFare - commissionOnOnline;
  let paidByDriver = 0;
  let paidToDriver = 0;
  for (const s of settlements) {
    const amt = Math.round(Number(s.amount) || 0);
    if (s.direction === 'company_to_driver') paidToDriver += amt;
    else paidByDriver += amt;
  }
  return {
    cashFare,
    onlineFare,
    commissionPct: Math.round(pct * 1000) / 10,
    commissionOnCash,
    driverShareOnline,
    driverEarnings: cashFare + onlineFare - commissionOnCash - commissionOnOnline,
    paidByDriver,
    paidToDriver,
    balance: commissionOnCash - driverShareOnline - paidByDriver + paidToDriver,
  };
}

export function paymentLabel(method?: string | null): string {
  switch (String(method || 'cash')) {
    case 'cash':
      return '💵 Cash';
    case 'driver_upi':
      return '📱 Your UPI';
    case 'upi_qr':
      return '🔳 UPI QR';
    case 'wallet':
      return '👛 Wallet';
    default:
      return '💳 Online';
  }
}
