import type { ConfigService } from '@nestjs/config';

/**
 * Resolved SMTP settings. `null` means mail is disabled (no SMTP configured),
 * which is valid for environments/tests that do not send email.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

export const SMTP_CONFIG = Symbol('SMTP_CONFIG');

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return String(value);
}

function asSecure(value: unknown): boolean {
  return asString(value)?.toLowerCase() === 'true';
}

/**
 * Reads SMTP settings from configuration. Environment validation already
 * guarantees the group is complete and well-formed when any value is present;
 * this normalizes types (ConfigService may expose values as strings).
 */
export function readSmtpConfig(config: ConfigService): SmtpConfig | null {
  const host = asString(config.get('SMTP_HOST'));
  const from = asString(config.get('MAIL_FROM'));
  if (!host || !from) {
    return null;
  }

  const user = asString(config.get('SMTP_USER'));
  const password = asString(config.get('SMTP_PASSWORD'));

  return {
    host,
    port: Number(asString(config.get('SMTP_PORT')) ?? 587),
    secure: asSecure(config.get('SMTP_SECURE')),
    ...(user ? { user } : {}),
    ...(password ? { password } : {}),
    from,
  };
}
