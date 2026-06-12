// ── Pending Middleman Cache
// Flow middleman butuh data payment-method SETELAH modal awal ketutup
// (modal Discord ga bisa ada select menu di dalemnya, plus udah mentok
// 5-input cap). Biar user experience-nya tetep mulus kayak satu flow,
// data form yang udah valid kita simpen di sini pake key guildId+userId,
// terus diambil pas user milih metode pembayaran di select menu lanjutan.
//
// Entry-nya auto-expire biar flow yang ditinggal ga numpuk di memory.

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
