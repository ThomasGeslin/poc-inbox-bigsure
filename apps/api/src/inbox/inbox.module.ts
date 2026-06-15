import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { ConversationsController } from './controllers/conversations.controller';
import { WebhooksController } from './controllers/webhooks.controller';

// Command handlers
import { SendMessageHandler } from './commands/send-message.handler';
import { ReceiveInboundMessageHandler } from './commands/receive-inbound-message.handler';
import { UpdateConversationStatusHandler } from './commands/update-conversation-status.handler';

// Query handlers
import { GetConversationsHandler } from './queries/get-conversations.handler';
import { GetConversationMessagesHandler } from './queries/get-conversation-messages.handler';

// Services
import { TwilioService } from './services/twilio.service';

const CommandHandlers = [
  SendMessageHandler,
  ReceiveInboundMessageHandler,
  UpdateConversationStatusHandler,
];

const QueryHandlers = [GetConversationsHandler, GetConversationMessagesHandler];

@Module({
  imports: [CqrsModule],
  controllers: [ConversationsController, WebhooksController],
  providers: [...CommandHandlers, ...QueryHandlers, TwilioService],
})
export class InboxModule {}
