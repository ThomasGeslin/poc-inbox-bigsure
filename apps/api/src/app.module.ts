import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { InboxModule } from './inbox/inbox.module';

@Module({
  imports: [PrismaModule, InboxModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
