#!/usr/bin/env node
/**
 * Opt-in real-SMTP smoke test. NOT part of `pnpm verify` or CI — it requires a
 * working SMTP configuration in apps/api/.env.
 *
 * Usage (from the repository root):
 *   pnpm mail:smoke -- recipient@example.com
 *
 * Sends one test email through the application's MailService. Never prints SMTP
 * credentials or configuration values.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const recipient = process.argv.slice(2).find((arg) => arg !== '--');
if (!recipient || !recipient.includes('@')) {
  console.error('Usage: pnpm mail:smoke -- <recipient@example.com>');
  process.exit(1);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(scriptDirectory, '..', '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app.module.js');
const { MailService } = await import('../dist/modules/mail/mail.service.js');

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

try {
  const mail = app.get(MailService);
  await mail.send({
    to: recipient,
    subject: 'smShop SMTP smoke test',
    text: 'This is a smoke test from smShop email infrastructure.',
    html: '<p>This is a smoke test from smShop email infrastructure.</p>',
  });
  console.log('SMTP smoke test: message accepted by the provider.');
} catch (error) {
  const name = error instanceof Error ? error.name : 'Error';
  console.error(`SMTP smoke test failed (${name}).`);
  process.exitCode = 1;
} finally {
  await app.close();
}
