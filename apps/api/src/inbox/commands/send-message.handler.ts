import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TwilioService } from '../services/twilio.service';
import { MsGraphMailService } from '../services/ms-graph-mail.service';
import { SendMessageCommand } from './send-message.command';
import { extFromFilename } from '../utils/attachment.utils';
import { StorageService } from '../services/storage.service';
import { Message } from '@prisma/client';
import { RealtimeService } from '../../realtime/realtime.service';

@CommandHandler(SendMessageCommand)
export class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
  private readonly logger = new Logger(SendMessageHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioService: TwilioService,
    private readonly msGraphMailService: MsGraphMailService,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeService,
  ) {}

  async execute(command: SendMessageCommand): Promise<Message> {
    const { conversationId, channel, content, subject, attachments } = command;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    let outboundMeta: Record<string, unknown> | undefined;
    // Subject to backfill onto the conversation when it was previously blank.
    let subjectToPersist: string | undefined;

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

      // Threading: find last MAIL message in this conversation that has a graphId
      const lastMailMessage = await this.prisma.message.findFirst({
        where: { conversationId, channel: 'MAIL' },
        orderBy: { timestamp: 'desc' },
      });

      const lastMeta = lastMailMessage?.meta as Record<string, unknown> | null;
      const inReplyToGraphId = lastMeta?.graphId as string | undefined;
      const inReplyTo = lastMeta?.messageId as string | undefined;

      const htmlContent = content.startsWith('<')
        ? content
        : `<p>${content.replace(/\n/g, '<br>')}</p>`;

      let sentMessageId: string;
      // Graph id to thread off for the NEXT outbound message in this thread.
      // We carry forward the original inbound message's id so that consecutive
      // outbound replies (no contact reply in between) keep threading to the
      // same thread instead of starting a fresh one.
      let outboundGraphId: string | undefined;
      try {
        if (inReplyToGraphId) {
          // Use Graph createReply for proper RFC threading (In-Reply-To / References)
          sentMessageId = await this.msGraphMailService.replyToMessage(
            this.msGraphMailService.defaultFrom,
            inReplyToGraphId,
            htmlContent,
            attachments,
          );
          outboundGraphId = inReplyToGraphId;
        } else {
          sentMessageId = await this.msGraphMailService.sendEmail(
            email,
            emailSubject,
            htmlContent,
            { attachments },
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Graph sendMail failed, aborting persist: ${msg}`);
        throw err;
      }

      outboundMeta = {
        messageId: sentMessageId,
        inReplyTo,
        ...(outboundGraphId ? { graphId: outboundGraphId } : {}),
      };

      // Backfill the conversation subject if it was previously blank.
      if (!conversation.subject && emailSubject) {
        subjectToPersist = emailSubject;
      }
    }

    // ── Upload attachments to storage, collect public URLs (all channels) ───
    let mediaUrls: string[] | undefined;
    if (attachments?.length) {
      mediaUrls = [];
      for (const file of attachments) {
        const url = await this.storage.upload(
          file.buffer,
          file.mimetype,
          extFromFilename(file.originalname),
        );
        mediaUrls.push(url);
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
          await this.twilioService.sendSms(phone, content, mediaUrls);
        } else {
          await this.twilioService.sendWhatsApp(phone, content, mediaUrls);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Twilio send failed, aborting persist: ${msg}`);
        throw err;
      }
    }

    const messageMeta: Record<string, unknown> | undefined =
      outboundMeta ?? (subject ? { subject } : undefined);

    // Include media URLs in meta for display in the frontend
    const finalMeta: Record<string, unknown> = {
      ...(messageMeta ?? {}),
      ...(mediaUrls?.length ? { mediaUrls } : {}),
    };

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          channel,
          direction: 'OUTBOUND',
          content,
          meta:
            Object.keys(finalMeta).length > 0
              ? (finalMeta as object)
              : undefined,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          unreadCount: 0,
          channel,
          ...(subjectToPersist ? { subject: subjectToPersist } : {}),
        },
      }),
    ]);

    // Realtime push so other connected clients see the outbound message live.
    // The sending client already appended it optimistically and dedupes by id.
    this.realtime.emitMessageCreated(message);
    void this.realtime.emitConversationUpdated(conversationId);

    return message;
  }
}
