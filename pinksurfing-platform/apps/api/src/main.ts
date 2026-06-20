import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const corsOrigins = config.get<string>('corsOrigins')?.trim();
  const origin =
    corsOrigins && corsOrigins.length > 0
      ? corsOrigins.split(',').map((s) => s.trim())
      : true;
  app.enableCors({
    origin,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Auth-Address',
      'X-Auth-Timestamp',
      'X-Auth-Signature',
    ],
  });
  const port = config.get<number>('port') ?? 8080;
  await app.listen(port);
  console.log(`PinkSurfing gateway listening on :${port}`);
}
bootstrap();
