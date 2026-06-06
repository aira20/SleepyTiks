// ─── Pending Middleman Cache ────────────────────────────────────────────────
//
// The middleman ticket flow needs to collect payment-method info AFTER the
// initial form modal closes (Discord modals don't allow select menus inside,
// and we hit the 5-input cap with the existing fields). To keep the user
// experience as a single continuous flow we stash the validated form data
// here keyed by guildId+userId, then drain it when the user picks a payment
// method from the follow-up select menu.
//
// Entries auto-expire so an abandoned flow can't pile up in memory.
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingMiddleman {
  formData: Record<string, string>;
  /** Epoch ms when this entry was stored. */
  storedAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const store = new Map<string, PendingMiddleman>();

function makeKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function pruneExpired(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [key, entry] of store.entries()) {
    if (entry.storedAt < cutoff) store.delete(key);
  }
}

export function setPendingMiddleman(
  guildId: string,
  userId: string,
  formData: Record<string, string>,
): void {
  pruneExpired();
  store.set(makeKey(guildId, userId), { formData, storedAt: Date.now() });
}

export function takePendingMiddleman(
  guildId: string,
  userId: string,
): Record<string, string> | null {
  pruneExpired();
  const key = makeKey(guildId, userId);
  const entry = store.get(key);
  if (!entry) return null;
  store.delete(key);
  return entry.formData;
}

export function peekPendingMiddleman(
  guildId: string,
  userId: string,
): Record<string, string> | null {
  pruneExpired();
  const entry = store.get(makeKey(guildId, userId));
  return entry ? entry.formData : null;
}
