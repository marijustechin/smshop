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
  'JWT_REFRESH_SECRET',
  'SMTP_PASSWORD',
  'GOOGLE_CLIENT_SECRET',
] as const;

type SecretKey = (typeof SECRET_KEYS)[number];

export type FileReader = (path: string) => string;

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function isPostgresUrl(value: string): boolean {
  return value.startsWith('postgres://') || value.startsWith('postgresql://');
}

/**
 * Configuration contract. Variables required today are mandatory; variables
 * reserved for Auth v1 are optional and validated only when present, so
 * declaring them early never blocks the current scaffold.
 */
export const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // Database (application-owned). No production fallback.
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(isPostgresUrl, 'must be a PostgreSQL URL (postgres:// or postgresql://)'),

  // Origins — reserved; required when CORS / OAuth redirects / email links land.
  WEB_ORIGIN: z.url().optional(),
  API_ORIGIN: z.url().optional(),

  // Access token — reserved for Auth v1.
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_TTL: z.string().min(1).optional(),

  // Refresh / session — reserved for Auth v1.
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_TTL: z.string().min(1).optional(),

  // Email — reserved for Auth v1.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  MAIL_FROM: z.email().optional(),

  // Google OAuth — reserved for Auth v1.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CALLBACK_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

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
 * Central environment validation boundary. Passed to `ConfigModule.forRoot`,
 * so invalid required configuration fails application startup.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const resolved = resolveSecretFiles(raw);
  const result = envSchema.safeParse(resolved);
  if (!result.success) {
    throw new Error(formatEnvError(result.error, resolved));
  }
  return result.data;
}
