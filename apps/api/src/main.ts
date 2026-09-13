import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const port = app.get(ConfigService).getOrThrow<number>('PORT');

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health/ready', method: RequestMethod.GET }],
  });
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
