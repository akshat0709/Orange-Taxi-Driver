// Classification helpers for errors returned (not thrown) by supabase-js.

export interface SupabaseErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

/**
 * True only when the RPC itself does not exist on the server (not deployed yet).
 * Any other RPC error — "booking already taken", "driver suspended", "invalid OTP" — is a real
 * server decision and must NOT trigger a client-side fallback that bypasses it.
 */
export function isMissingRpcError(error: SupabaseErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return msg.includes('could not find the function');
}

/**
 * True when the request most likely never reached the database (offline, DNS, timeout).
 * PostgREST/Postgres errors always carry a code; fetch failures surface without one.
 */
export function isNetworkError(error: SupabaseErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg === ''
  );
}

/** Statuses a queued (offline) driver update may still overwrite. */
export const REPLAYABLE_FROM_STATUSES = ['accepted', 'arrived', 'in_progress'] as const;
