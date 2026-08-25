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
