/**
 * The app is served from a subpath — `balenthiran.co.uk/birthday/` — and the
 * ingress does NOT rewrite it away (see helm/values.yaml and vite.config.ts
 * `base`). So every server-relative URL this client builds has to carry the
 * prefix itself. A leading-slash URL like "/api/auth/join" is resolved by the
 * browser against the *site root*, which on this host is the portfolio, not
 * this app — it 404s, and it 404s only in production, because in dev the app
 * is the only thing on localhost.
 *
 * That is exactly how the first deploy shipped broken: `baseUrl: "/"` in
 * emptyApi.ts sent every API call to balenthiran.co.uk/api/... The e2e suite
 * could not catch it because it mocks the network at the route level.
 *
 * Vite handles this for *assets* (anything imported, and paths in index.html)
 * by prefixing `base` at build time. It cannot do it for URLs assembled at
 * runtime, which is everything below.
 */

/** Trailing-slash form, e.g. "/birthday/". This is Vite's `base` verbatim. */
export const basePath = import.meta.env.BASE_URL;

/**
 * Prefixes the deployment's base path onto a server-relative URL.
 *
 * Absolute URLs pass through untouched: when `PhotoStorage__PublicBaseUrl` is
 * configured the backend returns a real bucket URL, and prefixing that would
 * break it.
 */
export function resolveServerUrl(url: string): string {
  if (!url) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return url;

  return `${basePath.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}
