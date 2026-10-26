// Razorpay UPI QR for "pay the chauffeur" rides. The QR is created and checked by the Orange Taxi
// website's server (it holds the Razorpay keys); the money goes to Orange Taxi's account and the
// server marks the ride paid online (payment_method 'upi_qr'), so it is never cash the driver holds.
export const WEB_API_URL = (process.env.EXPO_PUBLIC_WEB_API_URL || 'https://orange-taxi.com').replace(/\/+$/, '');

export type UpiQr = {
  id: string;
  amount: number;
  status: 'pending' | 'paid' | 'closed';
  image_url: string;
};

type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

async function call(path: string, accessToken: string, init: any, fetchImpl: FetchLike): Promise<UpiQr> {
  const res = await fetchImpl(`${WEB_API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.ok || !body?.qr) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body.qr as UpiQr;
}

export function createRideQr(bookingId: string, accessToken: string, fetchImpl: FetchLike = fetch as any) {
  return call('/api/qr/ride', accessToken, { method: 'POST', body: JSON.stringify({ bookingId }) }, fetchImpl);
}

export function getQrStatus(qrId: string, accessToken: string, fetchImpl: FetchLike = fetch as any) {
  return call(`/api/qr/status?id=${encodeURIComponent(qrId)}`, accessToken, { method: 'GET' }, fetchImpl);
}

/** Pay Orange Taxi yourself: hand in cash (company driver) or commission (commission driver).
 * The server caps the amount at what you owe. */
export function createSelfPayQr(
  kind: 'cash_deposit' | 'commission',
  driverId: string,
  amount: number,
  accessToken: string,
  fetchImpl: FetchLike = fetch as any
) {
  // link: a Razorpay payment page that opens the driver's own UPI app on this phone.
  return call('/api/qr/deposit', accessToken, { method: 'POST', body: JSON.stringify({ kind, driverId, amount, link: true }) }, fetchImpl);
}
