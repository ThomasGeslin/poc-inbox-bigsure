import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { MsGraphMailService } from './inbox/services/ms-graph-mail.service';

async function bootstrap() {
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
    origin: ['http://localhost:5173', 'http://localhost:5174'],
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
