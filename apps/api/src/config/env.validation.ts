import { readFileSync } from 'node:fs';
import { z } from 'zod';

/**
 * Environment variables that hold secrets. For each of these the API accepts
 * either a direct value or a file-based value via `<NAME>_FILE`, which fits
 * container secret mounts. File-based values are resolved before validation.
 */
export const SECRET_KEYS = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'SMTP_PASSWORD',
  'GOOGLE_CLIENT_SECRET',
  'TURNSTILE_SECRET_KEY',
  'DB_PASSWORD',
] as const;

type SecretKey = (typeof SECRET_KEYS)[number];

/**
 * SMTP settings are all-or-none: if any is configured the rest are required, so
 * partial configuration fails fast. If none is configured, mail is disabled and
 * startup still succeeds (CI/tests need no real SMTP credentials).
 */
export const SMTP_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM',
] as const;

/**
 * Google OAuth settings are all-or-none. If none is configured, Google
 * authentication is disabled and startup still succeeds (CI/tests need no
 * Google credentials); a partial configuration fails fast.
 */
export const GOOGLE_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
] as const;

/**
 * Optional database connection components. The accepted infrastructure secret
 * model mounts the database password as a file and expects the application to
 * assemble the connection URL in process, so the credential is never rendered
 * into a nonsecret environment value or Compose interpolation. When a full
 * `DATABASE_URL` (or `DATABASE_URL_FILE`) is not supplied, the API assembles
 * one from these components plus the password (`DB_PASSWORD` or
 * `DB_PASSWORD_FILE`). `DB_PORT` defaults to `5432`.
 */
export const DB_COMPONENT_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
] as const;

export type FileReader = (path: string) => string;

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function isPostgresUrl(value: string): boolean {
  return value.startsWith('postgres://') || value.startsWith('postgresql://');
}

/**
 * Accepts a bare email address or a formatted sender such as
 * `Šokolado meistrai <noreply@example.com>`. Header-injection characters are
 * rejected. This is intentionally not a full RFC parser.
 */
export function isMailFrom(value: string): boolean {
  if (/[\r\n]/.test(value)) {
    return false;
  }
  const angle = value.match(/^.*<([^<>]+)>\s*$/);
  const address = (angle ? angle[1] : value).trim();
  return z.email().safeParse(address).success;
}

/** Parses an explicit boolean from strings like "true"/"false"/"1"/"0". */
const booleanString = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => value === 'true' || value === 'false', {
    message: 'must be "true" or "false"',
  })
  .transform((value) => value === 'true');

/** Durations accepted by the token/session TTLs, e.g. "15m", "7d". */
const duration = z
  .string()
  .trim()
  .regex(/^\d+(s|m|h|d)$/, 'must be a duration like "15m" or "7d"');

/**
 * Configuration contract. Variables required today are mandatory; variables
 * reserved for Auth v1 are optional and validated only when present, so
 * declaring them early never blocks the current scaffold.
 */
export const envSchema = z
  .object({
    // Application
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),

    // Database (application-owned). Either a full URL is supplied, or it is
    // assembled from the components below (see the database refinement).
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine(isPostgresUrl, 'must be a PostgreSQL URL (postgres:// or postgresql://)')
      .optional(),

    // Optional database connection components used to assemble DATABASE_URL
    // when a full URL is not provided (see DB_COMPONENT_KEYS).
    DB_HOST: z.string().min(1).optional(),
    DB_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    DB_NAME: z.string().min(1).optional(),
    DB_USER: z.string().min(1).optional(),
    DB_PASSWORD: z.string().min(1).optional(),

    // Origins. WEB_ORIGIN is required: it is used for CORS with credentials and
    // for building email links.
    WEB_ORIGIN: z.url(),
    API_ORIGIN: z.url().optional(),

    // Access token — required now that login is implemented.
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: duration.default('15m'),

    // Refresh session — refresh tokens are opaque, so no refresh secret exists.
    AUTH_SESSION_TTL: duration.default('7d'),

    // One-off first-administrator bootstrap. When set, the API promotes the
    // already-existing, email-verified user with this exact address to `admin`
    // on startup. Never creates a user; idempotent; removable after first use.
    AUTH_INITIAL_ADMIN_EMAIL: z.string().trim().pipe(z.email()).optional(),

    // Email — the SMTP group is all-or-none (see SMTP_KEYS).
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_SECURE: booleanString.optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    MAIL_FROM: z
      .string()
      .min(1)
      .refine(isMailFrom, 'must be an email or "Name <email>"')
      .optional(),

    // Google OAuth — all-or-none (see GOOGLE_KEYS). Disabled when absent.
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_CALLBACK_URL: z.url().optional(),

    // Cloudflare Turnstile for public abuse-sensitive auth actions. When the
    // secret is absent, Turnstile is disabled (local dev / CI need no secret);
    // when present, the four protected endpoints fail closed on a failed or
    // unavailable challenge. Supports TURNSTILE_SECRET_KEY_FILE.
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    // A full URL always wins. Otherwise the component group is required in
    // full; a partial group fails fast with the missing names.
    if (hasValue(env.DATABASE_URL)) {
      return;
    }
    const configured = DB_COMPONENT_KEYS.filter((key) => hasValue(env[key]));
    if (configured.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message:
          'DATABASE_URL is required, or provide DB_HOST/DB_NAME/DB_USER/DB_PASSWORD (DB_PASSWORD supports DB_PASSWORD_FILE)',
      });
      return;
    }
    for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const) {
      if (!hasValue(env[key])) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when database components are configured`,
        });
      }
    }
  })
  .superRefine((env, ctx) => {
    const configured = SMTP_KEYS.filter((key) => hasValue(env[key]));
    if (configured.length === 0) {
      return;
    }
    for (const key of SMTP_KEYS) {
      if (!hasValue(env[key])) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when SMTP/mail is configured`,
        });
      }
    }
  })
  .superRefine((env, ctx) => {
    const configured = GOOGLE_KEYS.filter((key) => hasValue(env[key]));
    if (configured.length === 0) {
      return;
    }
    for (const key of GOOGLE_KEYS) {
      if (!hasValue(env[key])) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when Google authentication is configured`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Assembles a PostgreSQL connection URL from the optional component variables.
 * Returns `undefined` when the required components are not all present, so the
 * caller can fall back to the normal `DATABASE_URL` requirement. The user and
 * password are URL-encoded so credentials containing reserved characters are
 * handled correctly.
 */
export function assembleDatabaseUrl(env: Record<string, unknown>): string | undefined {
  const host = asNonEmptyString(env.DB_HOST);
  const name = asNonEmptyString(env.DB_NAME);
  const user = asNonEmptyString(env.DB_USER);
  const password = asNonEmptyString(env.DB_PASSWORD);
  if (!host || !name || !user || !password) {
    return undefined;
  }
  const port = asNonEmptyString(env.DB_PORT) ?? '5432';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

/**
 * Resolves `<NAME>_FILE` secret definitions into `<NAME>` values. A direct
 * value always wins over a file. Throws a clear error if a declared file cannot
 * be read, without echoing file contents.
 */
export function resolveSecretFiles(
  env: Record<string, unknown>,
  readFile: FileReader = (path) => readFileSync(path, 'utf8'),
): Record<string, unknown> {
  const resolved: Record<string, unknown> = { ...env };

  for (const key of SECRET_KEYS) {
    const filePath = env[`${key}_FILE`];
    if (typeof filePath === 'string' && filePath.length > 0 && !hasValue(resolved[key])) {
      try {
        resolved[key] = readFile(filePath).replace(/\r?\n$/, '');
      } catch {
        throw new Error(`Invalid environment configuration: failed to read ${key}_FILE`);
      }
    }
  }

  return resolved;
}

function collectSecretValues(env: Record<string, unknown>): string[] {
  const values: string[] = [];
  for (const key of SECRET_KEYS as readonly SecretKey[]) {
    const value = env[key];
    if (typeof value === 'string' && value.length > 0) {
      values.push(value);
    }
  }
  return values;
}

/**
 * Builds a startup error listing only variable names and validation messages,
 * never values. Any resolved secret value is scrubbed defensively.
 */
export function formatEnvError(error: z.ZodError, resolved: Record<string, unknown>): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `  - ${path}: ${issue.message}`;
  });

  let message = `Invalid environment configuration:\n${lines.join('\n')}`;
  for (const value of collectSecretValues(resolved)) {
    message = message.split(value).join('[redacted]');
  }
  return message;
}

/**
 * Treats empty-string variables as unset, so a `.env` placeholder such as
 * `SMTP_HOST=` does not count as configured and `MAIL_FROM=` does not fail
 * validation. Secrets resolved from files are already populated.
 */
function stripEmptyStrings(env: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Central environment validation boundary. Passed to `ConfigModule.forRoot`,
 * so invalid required configuration fails application startup.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const resolved = stripEmptyStrings(resolveSecretFiles(raw));
  // Assemble DATABASE_URL from components only when no full URL was supplied.
  // An explicit DATABASE_URL or DATABASE_URL_FILE always wins.
  if (!hasValue(resolved.DATABASE_URL)) {
    const assembled = assembleDatabaseUrl(resolved);
    if (assembled) {
      resolved.DATABASE_URL = assembled;
    }
  }
  const result = envSchema.safeParse(resolved);
  if (!result.success) {
    throw new Error(formatEnvError(result.error, resolved));
  }
  return result.data;
}
