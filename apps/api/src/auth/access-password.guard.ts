import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { ALLOW_QUERY_TOKEN_KEY, IS_PUBLIC_KEY } from './public.decorator';

export const ACCESS_PASSWORD_HEADER = 'x-poc-password';

interface GuardedRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
}

/** Constant-time comparison that tolerates a length mismatch. */
function passwordMatches(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  // timingSafeEqual throws when lengths differ, so short-circuit first. The
  // length of the expected password is not secret.
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

/**
 * Global guard requiring a single shared password on every route, supplied in
 * the `x-poc-password` header. Fails closed: if `APP_ACCESS_PASSWORD` is not
 * configured, guarded routes are rejected rather than left open.
 *
 * Opt out per route with `@Public()`, or allow the `?token=` form with
 * `@AllowQueryToken()`.
 */
@Injectable()
export class AccessPasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const expected = process.env.APP_ACCESS_PASSWORD;
    if (!expected) {
      throw new UnauthorizedException();
    }

    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const header = request.headers?.[ACCESS_PASSWORD_HEADER];
    const queryToken = this.reflector.getAllAndOverride<boolean>(
      ALLOW_QUERY_TOKEN_KEY,
      targets,
    )
      ? request.query?.token
      : undefined;

    const provided = typeof header === 'string' ? header : queryToken;

    if (typeof provided !== 'string' || !passwordMatches(provided, expected)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
