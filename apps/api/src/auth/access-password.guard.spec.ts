import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessPasswordGuard } from './access-password.guard';
import { AllowQueryToken, Public } from './public.decorator';

const PASSWORD = 'correct-horse-battery-staple';

/** Fixture routes exercising the real decorator metadata the guard reads. */
class TestRoutes {
  guarded(): void {}

  @Public()
  open(): void {}

  @AllowQueryToken()
  stream(): void {}
}

const routes = new TestRoutes();

interface ContextOptions {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  handler?: () => void;
}

/**
 * Minimal ExecutionContext double. Only the members the guard touches are
 * implemented; the Reflector and the decorators it reads are the real ones.
 */
function createContext({
  headers = {},
  query = {},
  handler = routes.guarded,
}: ContextOptions = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => TestRoutes,
    switchToHttp: () => ({
      getRequest: () => ({ headers, query }),
    }),
  } as unknown as ExecutionContext;
}

describe('AccessPasswordGuard', () => {
  let guard: AccessPasswordGuard;

  beforeEach(() => {
    process.env.APP_ACCESS_PASSWORD = PASSWORD;
    guard = new AccessPasswordGuard(new Reflector());
  });

  afterAll(() => {
    delete process.env.APP_ACCESS_PASSWORD;
  });

  it('allows a request carrying the correct password header', () => {
    const ctx = createContext({ headers: { 'x-poc-password': PASSWORD } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects a request carrying an incorrect password', () => {
    const ctx = createContext({ headers: { 'x-poc-password': 'wrong' } });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects a request carrying no credentials', () => {
    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a password longer than the expected one without crashing', () => {
    // timingSafeEqual throws a RangeError on length mismatch, so the guard must
    // compare lengths before reaching it.
    const ctx = createContext({
      headers: { 'x-poc-password': `${PASSWORD}-extra` },
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('allows a route marked @Public() with no credentials', () => {
    const ctx = createContext({ handler: routes.open });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a valid query token on a route marked @AllowQueryToken()', () => {
    const ctx = createContext({
      handler: routes.stream,
      query: { token: PASSWORD },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects an invalid query token on a route marked @AllowQueryToken()', () => {
    const ctx = createContext({
      handler: routes.stream,
      query: { token: 'wrong' },
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('ignores a query token on a route that does not allow one', () => {
    const ctx = createContext({ query: { token: PASSWORD } });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects every guarded request when APP_ACCESS_PASSWORD is unset', () => {
    delete process.env.APP_ACCESS_PASSWORD;
    const ctx = createContext({ headers: { 'x-poc-password': PASSWORD } });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('still allows a @Public() route when APP_ACCESS_PASSWORD is unset', () => {
    delete process.env.APP_ACCESS_PASSWORD;
    const ctx = createContext({ handler: routes.open });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
