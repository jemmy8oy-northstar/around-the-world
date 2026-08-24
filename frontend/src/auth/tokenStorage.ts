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

    return parsed as StoredSession;
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
