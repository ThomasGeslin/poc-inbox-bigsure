import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { MsGraphMailService } from './inbox/services/ms-graph-mail.service';
import { resolveCorsOrigins } from './cors-origins';

async function bootstrap() {
  // Fail fast rather than serve every endpoint unprotected: a forgotten
  // variable in the hosting dashboard would otherwise go unnoticed.
  if (!process.env.APP_ACCESS_PASSWORD) {
    throw new Error(
      'APP_ACCESS_PASSWORD must be defined — refusing to start with unprotected endpoints',
    );
  }

  const app = await NestFactory.create(AppModule);

  // Parse JSON and URL-encoded bodies (required for Twilio webhooks and REST API)
  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.enableCors({
    origin: resolveCorsOrigins(process.env.CORS_ORIGINS),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3000);

  // Register Graph mail subscriptions AFTER the server is listening so that
  // Graph's validation handshake can reach the webhook endpoint.
  const graphService = app.get(MsGraphMailService);
  await graphService.registerSubscriptions();
}

void bootstrap();
