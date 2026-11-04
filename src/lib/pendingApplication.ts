// Chauffeur applications are sent to the admin only after the email is verified.
//
// Sign-up creates the account and keeps the filled-in application on the phone. It is inserted into
// driver_applications once the 6-digit code is accepted, or, if the driver confirmed through the
// email link instead, the next time they sign in. Before this, the application was inserted right
// after sign-up, so unverified (and mistyped) emails reached the admin panel.

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type InsertClient = {
  from(table: string): { insert(row: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }> };
};

const KEY = '@orange_driver_pending_application';

// Columns every version of the driver_applications table has; used if the full row is rejected.
const BASE_COLUMNS = [
  'email', 'full_name', 'phone', 'city', 'licence_number', 'aadhaar_number', 'experience_years',
  'dl_url', 'owns_vehicle', 'status', 'message', 'admin_notes',
];

const norm = (email: string) => (email || '').trim().toLowerCase();

export async function savePendingApplication(
  storage: Storage,
  email: string,
  row: Record<string, unknown>
): Promise<void> {
  await storage.setItem(KEY, JSON.stringify({ email: norm(email), row }));
}

/** The saved application for this email, or null. */
export async function getPendingApplication(
  storage: Storage,
  email: string
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await storage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return saved?.email === norm(email) && saved.row ? saved.row : null;
  } catch {
    return null;
  }
}

export async function clearPendingApplication(storage: Storage): Promise<void> {
  await storage.removeItem(KEY);
}

/** Inserts the application (falling back to the base columns). Returns an error message or null. */
export async function insertApplication(
  client: InsertClient,
  row: Record<string, unknown>
): Promise<string | null> {
  const first = await client.from('driver_applications').insert(row);
  if (!first.error) return null;
  const base: Record<string, unknown> = {};
  for (const k of BASE_COLUMNS) if (k in row) base[k] = row[k];
  const retry = await client.from('driver_applications').insert(base);
  return retry.error ? retry.error.message || 'Could not submit the application.' : null;
}

/**
 * Sends the saved application for this (now verified) email, once. Returns 'none' when nothing is
 * waiting, 'sent' when it went through, or the error message (the application stays saved).
 */
export async function submitPendingApplication(
  storage: Storage,
  client: InsertClient,
  email: string
): Promise<'none' | 'sent' | string> {
  const row = await getPendingApplication(storage, email);
  if (!row) return 'none';
  const error = await insertApplication(client, row);
  if (error) return error;
  await clearPendingApplication(storage);
  return 'sent';
}
