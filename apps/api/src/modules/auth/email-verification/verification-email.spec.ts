import { describe, expect, it } from 'vitest';
import { buildVerificationEmail, buildVerificationUrl } from './verification-email.js';
import { EMAIL_VERIFICATION_TTL_HOURS } from './email-verification.constants.js';

describe('verification email', () => {
  const token = 'raw-token-value';

  it('builds a Lithuanian verification email with text and HTML', () => {
    const email = buildVerificationEmail({ webOrigin: 'https://example.com', token });

    expect(email.subject).toBe('Patvirtinkite savo el. pašto adresą');
    expect(email.text.toLowerCase()).toContain('patvirtinti');
    expect(email.html).toBeDefined();
    expect(email.html).toContain('Patvirtinti el. pašto adresą');
  });

  it('includes the frontend verification route with the token', () => {
    const email = buildVerificationEmail({ webOrigin: 'https://example.com', token });
    const expected = buildVerificationUrl('https://example.com', token);

    expect(expected).toBe('https://example.com/patvirtinti-el-pasta?token=raw-token-value');
    expect(email.text).toContain(expected);
    expect(email.html).toContain(expected);
  });

  it('normalizes a trailing slash in the origin', () => {
    expect(buildVerificationUrl('https://example.com/', token)).toBe(
      'https://example.com/patvirtinti-el-pasta?token=raw-token-value',
    );
  });

  it('states the token expiry', () => {
    const email = buildVerificationEmail({ webOrigin: 'https://example.com', token });

    expect(email.text).toContain(`${EMAIL_VERIFICATION_TTL_HOURS} val.`);
    expect(email.html).toContain(`${EMAIL_VERIFICATION_TTL_HOURS} val.`);
  });

  it('tells the recipient to ignore an unexpected email', () => {
    const email = buildVerificationEmail({ webOrigin: 'https://example.com', token });

    expect(email.text.toLowerCase()).toContain('ignoruoti');
    expect(email.html?.toLowerCase()).toContain('ignoruoti');
  });
});
