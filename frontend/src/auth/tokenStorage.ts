/**
 * Where the session lives between page loads.
 *
 * localStorage, not memory: the whole point is that someone joins once at the
 * first pub and is still logged in six pubs later, after the browser has been
 * backgrounded, killed by iOS to reclaim memory, and reopened.
 */
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
  /**
   * Whether this player owns the admin surface. Only decides what the app draws
   * — every admin action is authorised server-side from the token, so editing
   * this in devtools gets you a tab whose every button returns 403.
   */
  isAdmin: boolean;
}

const STORAGE_KEY = "atw.session";

export function readSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredSession>;

    // A half-written or stale-shaped entry must not wedge the app on the join
    // screen forever — treat anything unusable as "not logged in".
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.username)
      return null;

    // Normalised rather than trusted: a session written before this field
    // existed has no isAdmin at all, and `undefined` must read as "not the
    // admin" rather than leaking into a truthiness check somewhere downstream.
    return { ...parsed, isAdmin: parsed.isAdmin === true } as StoredSession;
  } catch {
    return null;
  }
}

export function writeSession(session: StoredSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private browsing or a full quota. Staying logged in for this page load is
    // better than crashing the join.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do.
  }
}
