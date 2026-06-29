import { CommandHandler, CommandBus, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StartConversationCommand } from './start-conversation.command';
import { SendMessageCommand } from './send-message.command';
import {
  CONVERSATION_INCLUDE,
  serializeConversation,
  SerializedConversation,
} from '../serializers/inbox.serializer';

/**
 * Start a new conversation with an existing contact from the inbox.
 *
 * Mirrors the inbound logic ({@link ReceiveInboundMessageHandler}): a contact
 * has at most one open (non-TRAITE) conversation, so if one already exists we
 * reuse it instead of spawning a duplicate. The first outbound message is sent
 * by delegating to {@link SendMessageHandler}, which performs the actual send
 * (Graph / Twilio), persists the message and emits the realtime events.
 */
@CommandHandler(StartConversationCommand)
export class StartConversationHandler
  implements ICommandHandler<StartConversationCommand>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: StartConversationCommand,
  ): Promise<SerializedConversation> {
    const { contactId, channel, content, subject, attachments } = command;

    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }

    // Fail fast with a clear message before creating an empty conversation.
    if (channel === 'MAIL' && !contact.email) {
      throw new BadRequestException('Contact has no email address');
    }
    if (
      (channel === 'SMS' || channel === 'WHATSAPP') &&
      !contact.phone
    ) {
      throw new BadRequestException('Contact has no phone number');
    }

    // Reuse the contact's open conversation if there is one, matching the
    // single-open-conversation-per-contact rule used for inbound messages.
    let conversation = await this.prisma.conversation.findFirst({
      where: { contactId, status: { not: 'TRAITE' } },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contactId,
          channel,
          subject: subject ?? null,
        },
      });
    }

    // Delegate the actual send + persistence + realtime emit to the existing
    // send-message pipeline.
    await this.commandBus.execute(
      new SendMessageCommand(
        conversation.id,
        channel,
        content,
        subject,
        attachments,
      ),
    );

    const full = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: CONVERSATION_INCLUDE,
    });

    return serializeConversation(full);
  }
}
