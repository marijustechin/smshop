import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { HealthController } from './modules/health/health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { validateEnv } from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    MailModule,
    AuthModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
