import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReceiveMailCommand } from './receive-mail.command';
import { Message, Prisma } from '@prisma/client';

// Type of the interactive transaction client
type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@CommandHandler(ReceiveMailCommand)
export class ReceiveMailHandler implements ICommandHandler<ReceiveMailCommand> {
  private readonly logger = new Logger(ReceiveMailHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ReceiveMailCommand): Promise<Message> {
    const {
      from,
      subject,
      content,
      messageId,
      inReplyTo,
      references,
      senderName,
      graphMessageId,
    } = command;

    // ── Fast idempotency check before acquiring a transaction ─────────────
    // Avoids unnecessary DB round-trips when the message is clearly a duplicate.
    if (messageId) {
      const existing = await this.prisma.message.findUnique({
        where: { externalId: messageId },
      });

      if (existing) {
        this.logger.debug(
          `Duplicate inbound mail ignored — externalId=${messageId} already stored`,
        );
        return existing;
      }
    }

    // ── Single atomic transaction: contact + conversation + message ────────
    // If two concurrent threads both pass the fast check above and race here,
    // the one that loses will fail on the DB UNIQUE constraint on
    // messages.external_id. Postgres then rolls back the ENTIRE transaction
    // for the loser — contact and conversation included — so no duplicates.
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Find or create Contact
        let contact = await tx.contact.findFirst({
          where: { email: { equals: from, mode: 'insensitive' } },
        });
        if (!contact) {
          this.logger.log(
            `No contact found for ${from}, creating minimal contact`,
          );
          const name = senderName ?? from.split('@')[0] ?? from;
          contact = await tx.contact.create({ data: { name, email: from } });
        }

        // 2. Find conversation: threading → subject match → latest open → create
        let conversation = await this.findConversationByThreading(
          tx,
          contact.id,
          inReplyTo,
          references,
        );

        if (!conversation) {
          const normalizedSubject = subject
            .replace(/^(re|fwd?)\s*:\s*/i, '')
            .trim();
          conversation = await tx.conversation.findFirst({
            where: {
              contactId: contact.id,
              status: { not: 'TRAITE' },
              subject: { contains: normalizedSubject, mode: 'insensitive' },
            },
            orderBy: { lastMessageAt: 'desc' },
          });
        }

        if (!conversation) {
          conversation = await tx.conversation.findFirst({
            where: { contactId: contact.id, status: { not: 'TRAITE' } },
            orderBy: { lastMessageAt: 'desc' },
          });
        }

        if (!conversation) {
          conversation = await tx.conversation.create({
            data: { contactId: contact.id, channel: 'MAIL', subject },
          });
        }

        // 3. Create message — UNIQUE constraint on externalId is the safety net.
        // If another transaction already inserted this message, this throws P2002
        // and Postgres rolls back this entire transaction (steps 1 & 2 included).
        const meta: Record<string, unknown> = {};
        if (messageId) meta.messageId = messageId;
        if (graphMessageId) meta.graphId = graphMessageId;
        if (inReplyTo) meta.inReplyTo = inReplyTo;
        if (references?.length) meta.references = references;

        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            channel: 'MAIL',
            direction: 'INBOUND',
            content,
            externalId: messageId ?? undefined,
            meta: Object.keys(meta).length > 0 ? (meta as object) : undefined,
          },
        });

        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 },
            channel: 'MAIL',
          },
        });

        return message;
      });
    } catch (err) {
      // UNIQUE constraint on externalId → whole transaction was rolled back.
      // Return the message stored by the winning concurrent thread.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.logger.debug(
          `Concurrent duplicate blocked by DB constraint — externalId=${messageId}`,
        );

        const existing = await this.prisma.message.findUnique({
          where: { externalId: messageId! },
        });

        return existing!;
      }

      throw err;
    }
  }

  private async findConversationByThreading(
    tx: Tx,
    contactId: string,
    inReplyTo?: string,
    references?: string[],
  ) {
    const candidates = [
      ...(inReplyTo ? [inReplyTo] : []),
      ...(references ?? []),
    ];

    for (const ref of candidates) {
      const priorMessage = await tx.message.findFirst({
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
