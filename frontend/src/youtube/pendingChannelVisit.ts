const KEY = "atw.channelVisitPending";

/**
 * The plug lives on the join screen, where nobody has a token yet — so a tap
 * cannot be attributed to a user at the moment it happens. It is parked here
 * instead and sent the moment a session exists.
 *
 * localStorage rather than sessionStorage: tapping the link can leave the tab
 * entirely (the YouTube app takes over on a phone), and coming back must not
 * lose the tap.
 */
export function markPending(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Private mode, or storage full. The badge is a joke; losing one is fine,
    // breaking the join screen over it is not.
  }
}

export function isPending(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPending(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}
