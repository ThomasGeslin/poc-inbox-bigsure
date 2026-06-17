import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { Message, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LogCallCommand, CallLogStatus } from './log-call.command';

@CommandHandler(LogCallCommand)
export class LogCallHandler implements ICommandHandler<LogCallCommand> {
  private readonly logger = new Logger(LogCallHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(command: LogCallCommand): Promise<Message> {
    const {
      phone,
      direction,
      callSid,
      status,
      duration,
      from,
      to,
      recordingUrl,
    } = command;

    // ── 1. Find or create Contact ────────────────────────────────────────
    let contact = await this.prisma.contact.findFirst({ where: { phone } });
    if (!contact) {
      this.logger.log(
        `No contact found for ${phone}, creating minimal contact`,
      );
      contact = await this.prisma.contact.create({
        data: { name: phone, phone },
      });
    }

    // ── 2. Find or create open Conversation ──────────────────────────────
    let conversation = await this.prisma.conversation.findFirst({
      where: { contactId: contact.id, status: { not: 'TRAITE' } },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contactId: contact.id,
          channel: 'CALL',
          subject: `Conversation with ${phone}`,
        },
      });
    }

    // ── 3. Build human-readable content ──────────────────────────────────
    const content = this.buildContent(direction, status, duration);

    // ── 4. Only increment unreadCount for missed inbound calls ───────────
    const isMissedInbound =
      direction === 'INBOUND' &&
      (status === 'no-answer' || status === 'busy' || status === 'failed');

    const meta: Record<string, unknown> = {
      callSid,
      direction: direction.toLowerCase(),
      status,
      duration,
      from,
      to,
      ...(recordingUrl ? { recordingUrl } : {}),
    };

    // ── 5. Persist message + update conversation in one transaction ───────
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          channel: 'CALL',
          direction,
          content,
          meta: meta as Prisma.InputJsonValue,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          channel: 'CALL',
          ...(isMissedInbound ? { unreadCount: { increment: 1 } } : {}),
        },
      }),
    ]);

    this.logger.log(
      `[log-call] Logged — callSid=${callSid} direction=${direction} status=${status} phone=${phone}`,
    );

    return message;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  private buildContent(
    direction: 'INBOUND' | 'OUTBOUND',
    status: CallLogStatus,
    duration: number,
  ): string {
    if (status === 'completed') {
      const dur = this.formatDuration(duration);

      return direction === 'INBOUND'
        ? `Appel entrant — ${dur}`
        : `Appel sortant — ${dur}`;
    }

    if (direction === 'INBOUND') return 'Appel manqué';

    return 'Appel sortant — sans réponse';
  }

  private formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;

    if (m === 0) return `${s}s`;

    return `${m} min ${s}s`;
  }
}
