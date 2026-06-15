import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReceiveMailCommand } from './receive-mail.command';
import { Message } from '@prisma/client';

@CommandHandler(ReceiveMailCommand)
export class ReceiveMailHandler implements ICommandHandler<ReceiveMailCommand> {
  private readonly logger = new Logger(ReceiveMailHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ReceiveMailCommand): Promise<Message> {
    const { from, subject, content, messageId, inReplyTo, references } =
      command;

    // ── 1. Find or create Contact by email ───────────────────────────────
    let contact = await this.prisma.contact.findFirst({
      where: { email: { equals: from, mode: 'insensitive' } },
    });

    if (!contact) {
      this.logger.log(`No contact found for ${from}, creating minimal contact`);
      const name = from.split('@')[0] ?? from;
      contact = await this.prisma.contact.create({
        data: { name, email: from },
      });
    }

    // ── 2. Find conversation: threading → subject match → latest open ────
    let conversation = await this.findConversationByThreading(
      contact.id,
      inReplyTo,
      references,
    );

    if (!conversation) {
      // Try to find open MAIL conversation with matching subject (strip Re:/Fwd: prefixes)
      const normalizedSubject = subject
        .replace(/^(re|fwd?)\s*:\s*/i, '')
        .trim();

      conversation = await this.prisma.conversation.findFirst({
        where: {
          contactId: contact.id,
          channel: 'MAIL',
          status: { not: 'TRAITE' },
          subject: { contains: normalizedSubject, mode: 'insensitive' },
        },
        orderBy: { lastMessageAt: 'desc' },
      });
    }

    if (!conversation) {
      // Fallback: reuse the most recent open MAIL conversation for this contact
      conversation = await this.prisma.conversation.findFirst({
        where: {
          contactId: contact.id,
          channel: 'MAIL',
          status: { not: 'TRAITE' },
        },
        orderBy: { lastMessageAt: 'desc' },
      });
    }

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contactId: contact.id,
          channel: 'MAIL',
          subject,
        },
      });
    }

    // ── 3. Persist message + update conversation ──────────────────────────
    const meta: Record<string, unknown> = {};
    if (messageId) meta.messageId = messageId;
    if (inReplyTo) meta.inReplyTo = inReplyTo;
    if (references?.length) meta.references = references;

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          channel: 'MAIL',
          direction: 'INBOUND',
          content,
          meta: Object.keys(meta).length > 0 ? (meta as object) : undefined,
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

  /**
   * Finds a conversation by looking up a prior message whose meta.messageId
   * matches the inbound In-Reply-To or References header values.
   */
  private async findConversationByThreading(
    contactId: string,
    inReplyTo?: string,
    references?: string[],
  ) {
    const candidates = [
      ...(inReplyTo ? [inReplyTo] : []),
      ...(references ?? []),
    ];

    for (const ref of candidates) {
      const priorMessage = await this.prisma.message.findFirst({
        where: {
          channel: 'MAIL',
          conversation: { contactId },
          meta: { path: ['messageId'], equals: ref },
        },
        include: { conversation: true },
      });

      if (priorMessage) return priorMessage.conversation;
    }

    return null;
  }
}
