import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { InboxModule } from './inbox/inbox.module';
import { AuthController } from './auth/auth.controller';
import { AccessPasswordGuard } from './auth/access-password.guard';

@Module({
  imports: [PrismaModule, InboxModule],
  controllers: [AppController, AuthController],
  providers: [
    AppService,
    // Applies to every route in the application; opt out with @Public().
    { provide: APP_GUARD, useClass: AccessPasswordGuard },
  ],
})
export class AppModule {}
