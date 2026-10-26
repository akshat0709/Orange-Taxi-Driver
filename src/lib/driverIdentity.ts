// Resolves which `drivers` row belongs to a signed-in Supabase user.
//
// SECURITY: a driver row must only be bound to an account through data the user cannot forge.
// The previous implementation fell back to `user.user_metadata.phone` — a value the user types in at
// sign-up — scanned up to 200 driver rows and matched on `endsWith(last 10 digits)`. Anyone could sign
// up with a real chauffeur's phone number and be logged in as that chauffeur, and an unlinked row was
// permanently re-assigned to them by the "self-heal" update. A phone with no digits matched every row.
//
// Rules now:
//   1. `drivers.user_id = auth user id` (the normal path).
//   2. Legacy rows with no user_id may be linked ONLY via the auth-verified `user.phone`
//      (set by Supabase phone auth, never user_metadata), on an exact 10-digit match, when exactly one
//      unlinked row matches. The link is a conditional update that cannot steal an already-linked row.
//
// The same check must be enforced server-side by RLS on `drivers` (see audit report).

export interface DriverRowLike {
  id: string;
  user_id?: string | null;
  phone?: string | null;
  [key: string]: any;
}

export interface AuthUserLike {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, any> | null;
}

/** Last 10 digits of an Indian mobile number, or null if fewer than 10 digits are present. */
export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/**
 * Picks the single unlinked legacy driver row whose phone exactly matches the verified phone.
 * Returns null when the phone is missing/short, nothing matches, or the match is ambiguous.
 */
export function matchLegacyDriverByVerifiedPhone<T extends DriverRowLike>(
  rows: T[] | null | undefined,
  verifiedPhone: string | null | undefined
): T | null {
  const target = normalizeIndianMobile(verifiedPhone);
  if (!target || !rows) return null;
  const matches = rows.filter(
    (row) => !row.user_id && normalizeIndianMobile(row.phone) === target
  );
  return matches.length === 1 ? matches[0] : null;
}

/** Minimal slice of the Supabase client used here (keeps this module testable). */
type SupabaseLike = { from: (table: string) => any };

export async function resolveDriverRowForUser(
  client: SupabaseLike,
  user: AuthUserLike
): Promise<DriverRowLike | null> {
  const { data: byUserId } = await client
    .from('drivers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (byUserId) return byUserId as DriverRowLike;

  // Legacy link: only Supabase-verified phone numbers are trusted.
  const verifiedPhone = normalizeIndianMobile(user.phone);
  if (!verifiedPhone) return null;

  // Stored phones are free-form ("+91 98765 43210"), so match digits client-side,
  // but only among rows that are not linked to any account yet.
  const { data: candidates } = await client
    .from('drivers')
    .select('id, user_id, phone')
    .is('user_id', null)
    .limit(500);

  const match = matchLegacyDriverByVerifiedPhone(candidates as DriverRowLike[] | null, verifiedPhone);
  if (!match) return null;

  // Conditional claim: succeeds only if the row is still unlinked.
  const { data: claimed } = await client
    .from('drivers')
    .update({ user_id: user.id })
    .eq('id', match.id)
    .is('user_id', null)
    .select('*')
    .maybeSingle();

  if (claimed) return claimed as DriverRowLike;

  // A concurrent sign-in flow may have just claimed it for this same user.
  const { data: recheck } = await client
    .from('drivers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  return (recheck as DriverRowLike) || null;
}
