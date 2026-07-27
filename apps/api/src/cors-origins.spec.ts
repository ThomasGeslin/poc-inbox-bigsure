import { DEV_CORS_ORIGINS, resolveCorsOrigins } from './cors-origins';

describe('resolveCorsOrigins', () => {
  it('falls back to the dev servers when nothing is configured', () => {
    expect(resolveCorsOrigins(undefined)).toEqual(DEV_CORS_ORIGINS);
  });

  it('falls back to the dev servers when the value holds no origin', () => {
    expect(resolveCorsOrigins('  ,  ')).toEqual(DEV_CORS_ORIGINS);
  });

  it('splits a comma-separated list and trims each entry', () => {
    expect(
      resolveCorsOrigins('https://a.vercel.app , https://b.vercel.app'),
    ).toEqual(['https://a.vercel.app', 'https://b.vercel.app']);
  });

  it('strips a trailing slash, which an Origin header never carries', () => {
    // Pasting a URL from a browser address bar keeps the slash, and the cors
    // package compares origins with strict equality — so it would never match.
    expect(resolveCorsOrigins('https://a.vercel.app/')).toEqual([
      'https://a.vercel.app',
    ]);
  });

  it('strips repeated trailing slashes', () => {
    expect(resolveCorsOrigins('https://a.vercel.app///')).toEqual([
      'https://a.vercel.app',
    ]);
  });

  it('keeps an explicit port', () => {
    expect(resolveCorsOrigins('http://localhost:4173/')).toEqual([
      'http://localhost:4173',
    ]);
  });
});
