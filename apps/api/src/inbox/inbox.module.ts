import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { ConversationsController } from './controllers/conversations.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { ContactsController } from './controllers/contacts.controller';
import { CallsController } from './controllers/calls.controller';

// Command handlers
import { SendMessageHandler } from './commands/send-message.handler';
import { ReceiveInboundMessageHandler } from './commands/receive-inbound-message.handler';
import { ReceiveMailHandler } from './commands/receive-mail.handler';
import { UpdateConversationStatusHandler } from './commands/update-conversation-status.handler';
import { UpdateContactHandler } from './commands/update-contact.handler';
import { CreateContactHandler } from './commands/create-contact.handler';
import { MarkAsReadHandler } from './commands/mark-as-read.handler';
import { LogCallHandler } from './commands/log-call.handler';

// Query handlers
import { GetConversationsHandler } from './queries/get-conversations.handler';
import { GetConversationMessagesHandler } from './queries/get-conversation-messages.handler';

// Services
import { TwilioService } from './services/twilio.service';
import { MsGraphMailService } from './services/ms-graph-mail.service';

const CommandHandlers = [
  SendMessageHandler,
  ReceiveInboundMessageHandler,
  ReceiveMailHandler,
  UpdateConversationStatusHandler,
  UpdateContactHandler,
  CreateContactHandler,
  MarkAsReadHandler,
  LogCallHandler,
];

const QueryHandlers = [GetConversationsHandler, GetConversationMessagesHandler];

@Module({
  imports: [CqrsModule],
  controllers: [
    ConversationsController,
    WebhooksController,
    ContactsController,
    CallsController,
  ],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    TwilioService,
    MsGraphMailService,
  ],
})
export class InboxModule {}
