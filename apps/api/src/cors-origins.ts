export const DEV_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
];

/**
 * Browser origins allowed to call the API: the deployed frontend in production
 * (comma-separated in CORS_ORIGINS), the Vite dev servers otherwise.
 *
 * Trailing slashes are stripped. An `Origin` header is only ever
 * `scheme://host[:port]`, and the cors package compares it by strict equality,
 * so a URL pasted from a browser address bar would silently match nothing.
 */
export function resolveCorsOrigins(raw: string | undefined): string[] {
  const configured = raw
    ?.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return configured?.length ? configured : DEV_CORS_ORIGINS;
}
