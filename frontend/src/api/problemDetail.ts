/**
 * Pulls the human-readable sentence out of an RFC 7807 ProblemDetails response.
 *
 * The API writes messages meant to be read by someone holding a phone in a pub
 * ("That party code is not right"), so showing them beats a generic failure
 * string — but only when one is actually present.
 */
export function problemDetail(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;

  const data = (error as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;

  const detail = (data as { detail?: unknown }).detail;
  return typeof detail === "string" && detail.trim().length > 0 ? detail : null;
}

/**
 * The message to show when a request fails.
 *
 * Every error the API's own handler produces carries a ProblemDetails `detail`
 * — even an unexpected fault, which yields "An unexpected error occurred". So
 * seeing the caller's generic fallback proves the request never reached the
 * app: it died at the proxy or on the wire. That distinction was invisible on
 * 27 Aug, when a 1MB ingress body cap rejected every photo with a raw HTML 413
 * and the compose screen could only say "That didn't send".
 *
 * So: prefer the API's sentence, then name the failures the proxy and the
 * network produce, and if it is none of those append the status — a guest can
 * read a number down the phone, and it beats an unfalsifiable "try again".
 */
export function failureMessage(error: unknown, fallback: string): string {
  const detail = problemDetail(error);
  if (detail) return detail;

  const status = (error as { status?: unknown } | null)?.status;

  if (status === 413) return "That photo is too big to send — try a smaller one.";
  if (status === 401) return "You've been signed out — join again.";
  if (status === "FETCH_ERROR") return "No connection — check your signal and try again.";
  if (typeof status === "number") return `${fallback} (error ${status})`;

  return fallback;
}
