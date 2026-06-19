import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReceiveInboundMessageCommand } from './receive-inbound-message.command';
import { Message, Prisma } from '@prisma/client';
import {
  parsePhoneNumberWithError,
  isValidPhoneNumber,
} from 'libphonenumber-js';

@CommandHandler(ReceiveInboundMessageCommand)
export class ReceiveInboundMessageHandler implements ICommandHandler<ReceiveInboundMessageCommand> {
  private readonly logger = new Logger(ReceiveInboundMessageHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ReceiveInboundMessageCommand): Promise<Message> {
    const { phone, channel, content, meta } = command;

    // Build candidate phone variants to match contacts stored with local or E.164 format
    const phoneVariants: string[] = [phone];

    try {
      if (isValidPhoneNumber(phone)) {
        const national = parsePhoneNumberWithError(phone)
          .formatNational()
          .replace(/\D/g, '');

        if (national && national !== phone) phoneVariants.push(national);
      }
    } catch {
      this.logger.error(`Failed to normalize phone number: ${phone}`);
    }

    // Find or create Contact by normalized phone number (also match local-format variants)
    let contact = await this.prisma.contact.findFirst({
      where: { phone: { in: phoneVariants } },
    });

    if (!contact) {
      this.logger.log(
        `No contact found for ${phone}, creating minimal contact`,
      );

      const profileName =
        channel === 'WHATSAPP' &&
        typeof meta?.profileName === 'string' &&
        meta.profileName
          ? meta.profileName
          : undefined;

      contact = await this.prisma.contact.create({
        data: {
          name: profileName ?? phone,
          phone,
        },
      });
    } else if (contact.phone !== phone) {
      // Self-heal: upgrade stored local-format number to E.164
      contact = await this.prisma.contact.update({
        where: { id: contact.id },
        data: { phone },
      });
    }

    // Find or create a single open Conversation for this contact (all channels merged)
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        contactId: contact.id,
        status: { not: 'TRAITE' },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contactId: contact.id,
          channel,
          subject: `Conversation with ${phone}`,
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
          meta:
            meta !== undefined
              ? (meta as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
          channel, // track last channel used
        },
      }),
    ]);

    return message;
  }
}
