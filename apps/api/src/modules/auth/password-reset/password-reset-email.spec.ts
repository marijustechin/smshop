import { describe, expect, it } from 'vitest';
import { buildPasswordResetEmail, buildPasswordResetUrl } from './password-reset-email.js';
import { PASSWORD_RESET_TTL_HOURS } from './password-reset.constants.js';

describe('password reset email', () => {
  const token = 'raw-reset-token';

  it('builds a Lithuanian reset email with text and HTML', () => {
    const email = buildPasswordResetEmail({ webOrigin: 'https://example.com', token });

    expect(email.subject).toBe('Slaptažodžio atkūrimas');
    expect(email.text.length).toBeGreaterThan(0);
    expect(email.html).toContain('Nustatyti naują slaptažodį');
  });

  it('includes the frontend reset route with the token', () => {
    const email = buildPasswordResetEmail({ webOrigin: 'https://example.com', token });
    const expected = buildPasswordResetUrl('https://example.com', token);

    expect(expected).toBe('https://example.com/atkurti-slaptazodi?token=raw-reset-token');
    expect(email.text).toContain(expected);
    expect(email.html).toContain(expected);
  });

  it('normalizes a trailing slash in the origin', () => {
    expect(buildPasswordResetUrl('https://example.com/', token)).toBe(
      'https://example.com/atkurti-slaptazodi?token=raw-reset-token',
    );
  });

  it('states the token expiry', () => {
    const email = buildPasswordResetEmail({ webOrigin: 'https://example.com', token });

    expect(email.text).toContain(`${PASSWORD_RESET_TTL_HOURS} val.`);
    expect(email.html).toContain(`${PASSWORD_RESET_TTL_HOURS} val.`);
  });

  it('explains that no change occurs unless the link is used, and to ignore unexpected mail', () => {
    const email = buildPasswordResetEmail({ webOrigin: 'https://example.com', token });
    const text = email.text.toLowerCase();

    expect(text).toContain('nebus pakeistas');
    expect(text).toContain('ignoruoti');
  });
});
