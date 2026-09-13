import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
  it('accepts local relative paths', () => {
    expect(safeReturnTo('/paskyra')).toBe('/paskyra');
    expect(safeReturnTo('/paskyra?tab=1')).toBe('/paskyra?tab=1');
  });

  it('falls back when missing', () => {
    expect(safeReturnTo(null)).toBe('/paskyra');
    expect(safeReturnTo('')).toBe('/paskyra');
    expect(safeReturnTo(undefined)).toBe('/paskyra');
  });

  it('rejects absolute URLs (open redirect)', () => {
    expect(safeReturnTo('https://evil.example.com')).toBe('/paskyra');
    expect(safeReturnTo('http://evil.example.com/path')).toBe('/paskyra');
  });

  it('rejects protocol-relative URLs', () => {
    expect(safeReturnTo('//evil.example.com')).toBe('/paskyra');
  });

  it('rejects backslashes and control characters', () => {
    expect(safeReturnTo('/\\evil')).toBe('/paskyra');
    expect(safeReturnTo('/path\u0000')).toBe('/paskyra');
  });

  it('respects a custom fallback', () => {
    expect(safeReturnTo('https://evil.example.com', '/registracija')).toBe('/registracija');
  });
});
