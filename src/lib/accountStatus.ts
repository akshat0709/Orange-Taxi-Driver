// After a failed sign-in, ask the Orange Taxi server whether an account exists for the email
// (Supabase says "Invalid login credentials" for both). Rate-limited on the server.
const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_API_URL || process.env.EXPO_PUBLIC_WEB_URL || 'https://orange-taxi.com';

export type AccountStatus = 'none' | 'unconfirmed' | 'exists' | null;

export async function accountStatus(email: string, fetchImpl: typeof fetch = fetch): Promise<AccountStatus> {
  try {
    const res = await fetchImpl(`${WEB_BASE_URL.replace(/\/+$/, '')}/api/auth/email-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const json: any = await res.json().catch(() => ({}));
    const s = json?.status;
    return res.ok && (s === 'none' || s === 'unconfirmed' || s === 'exists') ? s : null;
  } catch {
    return null;
  }
}
