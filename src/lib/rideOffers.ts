// Ride offers (20261104120000_dispatch_offers.sql): each new ride is offered to the 3 closest
// chauffeurs for 20 seconds, then the next 3, and after 3 rounds it is opened to everyone nearby.
// The server decides who sees which ride; the app asks my_ride_offers() and shows what it returns.
// If the database doesn't have the offers yet (older server), `supported` is false and the app keeps
// its old behaviour (every searching ride within 5 km).

type RpcError = { code?: string; message?: string; details?: string } | null;
type RpcClient = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: RpcError }>;
};

export interface RideOffer {
  booking_id: string;
  /** null for a ride opened to everyone nearby */
  expires_at: string | null;
  /** Google driving time to the pickup, when the server ranked by road */
  eta_seconds: number | null;
  is_open: boolean;
}

export const OFFER_SECONDS = 20;

function missingFunction(e: RpcError): boolean {
  const m = `${e?.message || ''} ${e?.details || ''}`;
  return e?.code === 'PGRST202' || e?.code === '42883' || /could not find the function|does not exist/i.test(m);
}

export async function fetchRideOffers(client: RpcClient): Promise<{ supported: boolean; offers: RideOffer[] }> {
  const { data, error } = await client.rpc('my_ride_offers');
  if (error) return { supported: !missingFunction(error), offers: [] };
  const rows = Array.isArray(data) ? (data as RideOffer[]) : [];
  return { supported: true, offers: rows.filter((r) => r && typeof r.booking_id === 'string') };
}

export async function declineRideOffer(client: RpcClient, bookingId: string): Promise<void> {
  try {
    await client.rpc('decline_ride_offer', { _booking_id: bookingId });
  } catch {
    /* best-effort: an unanswered offer simply expires */
  }
}

/** Personal offers first (soonest to expire), then rides opened to everyone; skips declined ones. */
export function pickOffer(offers: RideOffer[], skip: (bookingId: string) => boolean, now = Date.now()): RideOffer | null {
  const live = offers.filter(
    (o) => !skip(o.booking_id) && (o.is_open || (o.expires_at != null && Date.parse(o.expires_at) > now + 1000))
  );
  live.sort((a, b) => {
    if (a.is_open !== b.is_open) return a.is_open ? 1 : -1;
    return (a.expires_at ? Date.parse(a.expires_at) : Infinity) - (b.expires_at ? Date.parse(b.expires_at) : Infinity);
  });
  return live[0] ?? null;
}

/** Whole seconds left to answer (the phone clock may be a little off, so it is capped at 20). */
export function secondsLeft(expiresAt: string | null | undefined, now = Date.now(), fallback = 30): number {
  if (!expiresAt) return fallback;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return fallback;
  return Math.max(0, Math.min(OFFER_SECONDS, Math.round((t - now) / 1000)));
}

/** "4 min to pickup" from the road ETA, or null. */
export function pickupEtaLabel(etaSeconds: number | null | undefined): string | null {
  if (etaSeconds == null || !Number.isFinite(etaSeconds) || etaSeconds < 0) return null;
  return `${Math.max(1, Math.round(etaSeconds / 60))} min to pickup`;
}

/** Text for an error from accept_booking. */
export function acceptErrorMessage(error: string | undefined): { title: string; body: string } {
  if (error && /offered to other chauffeurs/i.test(error)) {
    return {
      title: 'Offered to closer chauffeurs',
      body: 'This ride is being offered to chauffeurs closer to the pickup first. If none of them take it, it will come back to you.',
    };
  }
  if (error && /already have an active ride/i.test(error)) {
    return { title: 'Ride in progress', body: 'Finish your current ride before accepting another one.' };
  }
  if (error && /not active/i.test(error)) {
    return { title: 'Account not active', body: error };
  }
  return {
    title: 'Ride already claimed',
    body: 'Another chauffeur accepted this ride just before you, or the passenger cancelled. You are ready for the next one.',
  };
}

// ---------------------------------------------------------------------------------------------
// "Riders are waiting nearby" (demand_hints in 20261104140000_demand_hints.sql)
export interface DemandHint {
  area: string;
  lat: number;
  lng: number;
  distance_km: number;
  riders: number;
  free_chauffeurs: number;
}

export async function fetchDemandHint(client: RpcClient): Promise<DemandHint | null> {
  try {
    const { data, error } = await client.rpc('demand_hints');
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const h = data[0] as DemandHint;
    return Number.isFinite(Number(h.lat)) && Number.isFinite(Number(h.lng))
      ? { ...h, lat: Number(h.lat), lng: Number(h.lng), distance_km: Number(h.distance_km) }
      : null;
  } catch {
    return null;
  }
}

export function demandHintText(h: DemandHint): string {
  const riders = `${h.riders} rider${h.riders === 1 ? '' : 's'} looked for a cab`;
  const cars = h.free_chauffeurs === 0 ? 'no free chauffeurs there' : `only ${h.free_chauffeurs} free chauffeur${h.free_chauffeurs === 1 ? '' : 's'} there`;
  return `${riders} in ${h.area} in the last hour, ${cars} · ${h.distance_km} km away`;
}

export function navigateUrl(h: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}&travelmode=driving`;
}

// ---------------------------------------------------------------------------------------------
// Acceptance rate (driver_offer_stats)
export async function fetchAcceptanceRate(client: RpcClient): Promise<number | null> {
  try {
    const { data, error } = await client.rpc('driver_offer_stats');
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const r = (data[0] as { acceptance_rate: number | null }).acceptance_rate;
    return r == null ? null : Number(r);
  } catch {
    return null;
  }
}
