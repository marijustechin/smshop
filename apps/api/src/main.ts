import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';

const port = Number(process.env.PORT ?? 3001);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health/ready', method: RequestMethod.GET }],
  });
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
