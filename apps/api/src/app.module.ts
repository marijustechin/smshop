import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
  controllers: [AppController, HealthController],
  providers: [PrismaService],
})
export class AppModule {}
