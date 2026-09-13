import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { HealthController } from './health.controller.js';
import { PrismaService } from './prisma.service.js';
import { validateEnv } from './config/env.validation.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
  controllers: [AppController, HealthController],
  providers: [PrismaService],
})
export class AppModule {}
