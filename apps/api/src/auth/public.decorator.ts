import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'poc:isPublic';
export const ALLOW_QUERY_TOKEN_KEY = 'poc:allowQueryToken';

/**
 * Exempts a route (or a whole controller) from the shared-password guard.
 * Used for inbound webhooks, which authenticate themselves through their own
 * mechanism (Twilio request signature, Graph `clientState`) and cannot send our
 * header, and for the health-check root route.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Additionally accepts the password as a `?token=` query parameter.
 *
 * Reserved for the SSE stream: the browser `EventSource` API cannot send custom
 * headers, so the query string is the only channel available. Do not spread
 * this to other routes — query strings land in access logs.
 */
export const AllowQueryToken = () => SetMetadata(ALLOW_QUERY_TOKEN_KEY, true);
