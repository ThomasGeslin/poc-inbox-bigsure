import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReceiveInboundMessageCommand } from './receive-inbound-message.command';
import { Message } from '@prisma/client';

@CommandHandler(ReceiveInboundMessageCommand)
export class ReceiveInboundMessageHandler implements ICommandHandler<ReceiveInboundMessageCommand> {
  private readonly logger = new Logger(ReceiveInboundMessageHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ReceiveInboundMessageCommand): Promise<Message> {
    const { phone, channel, content, meta } = command;

    // Find or create Contact by normalized phone number
    let contact = await this.prisma.contact.findFirst({
      where: { phone },
    });

    if (!contact) {
      this.logger.log(
        `No contact found for ${phone}, creating minimal contact`,
      );
      contact = await this.prisma.contact.create({
        data: {
          name: phone,
          phone,
        },
      });
    }

    // Find or create an open Conversation for this contact + channel
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        contactId: contact.id,
        channel,
        status: { not: 'TRAITE' },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contactId: contact.id,
          channel,
          subject: `${channel} inbound from ${phone}`,
        },
      });
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          channel,
          direction: 'INBOUND',
          content,
          meta: meta ?? undefined,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
        },
      }),
    ]);

    return message;
  }
}
