import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AccessLogService } from './common/access-log';
import { config } from './config';
import { DatabaseService } from './db/database.service';
import { migrar } from './db/migrator';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useBodyParser('json', { limit: '2mb' });
  // O log de acesso entra antes de tudo, para registrar também 401/404.
  app.use(app.get(AccessLogService).middleware);
  app.set('trust proxy', 'loopback');
  app.enableShutdownHooks();

  await migrar(app.get(DatabaseService), config.seedDemo);
  await app.listen(config.port, config.host);
  new Logger('clinical-service').log(`Ouvindo em http://${config.host}:${config.port}`);
}

void bootstrap();
