import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TwilioService } from '../services/twilio.service';
import { ResendService } from '../services/resend.service';
import { SendMessageCommand } from './send-message.command';
import { Message } from '@prisma/client';

@CommandHandler(SendMessageCommand)
export class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
  private readonly logger = new Logger(SendMessageHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioService: TwilioService,
    private readonly resendService: ResendService,
  ) {}

  async execute(command: SendMessageCommand): Promise<Message> {
    const { conversationId, channel, content, subject } = command;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    let outboundMeta: Record<string, unknown> | undefined;

    // ── MAIL ──────────────────────────────────────────────────────────────
    if (channel === 'MAIL') {
      const email = conversation.contact.email;

      if (!email) {
        throw new InternalServerErrorException(
          `Contact ${conversation.contactId} has no email address`,
        );
      }

      // Determine email subject: command override > conversation subject
      const emailSubject = subject || conversation.subject || '(sans objet)';

      // Threading: find last MAIL message in this conversation that has a messageId
      const lastMailMessage = await this.prisma.message.findFirst({
        where: { conversationId, channel: 'MAIL' },
        orderBy: { timestamp: 'desc' },
      });

      const lastMeta = lastMailMessage?.meta as Record<string, unknown> | null;
      const inReplyTo = lastMeta?.messageId as string | undefined;

      const htmlContent = content.startsWith('<')
        ? content
        : `<p>${content.replace(/\n/g, '<br>')}</p>`;

      let resendId: string;
      try {
        resendId = await this.resendService.sendEmail(
          email,
          emailSubject,
          htmlContent,
          inReplyTo ? { inReplyTo, references: [inReplyTo] } : undefined,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Resend send failed, aborting persist: ${msg}`);
        throw err;
      }

      outboundMeta = { messageId: resendId, inReplyTo };

      // Update conversation subject if it was blank
      if (!conversation.subject && emailSubject) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { subject: emailSubject },
        });
      }
    }

    // ── SMS / WHATSAPP ────────────────────────────────────────────────────
    if (channel === 'SMS' || channel === 'WHATSAPP') {
      const phone = conversation.contact.phone;
      if (!phone) {
        throw new InternalServerErrorException(
          `Contact ${conversation.contactId} has no phone number`,
        );
      }

      try {
        if (channel === 'SMS') {
          await this.twilioService.sendSms(phone, content);
        } else {
          await this.twilioService.sendWhatsApp(phone, content);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Twilio send failed, aborting persist: ${msg}`);
        throw err;
      }
    }

    const meta: Record<string, unknown> | undefined =
      outboundMeta ?? (subject ? { subject } : undefined);

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          channel,
          direction: 'OUTBOUND',
          content,
          meta:
            Object.keys(meta ?? {}).length > 0 ? (meta as object) : undefined,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), unreadCount: 0, channel },
      }),
    ]);

    return message;
  }
}
