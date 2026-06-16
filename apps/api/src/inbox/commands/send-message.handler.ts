import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TwilioService } from '../services/twilio.service';
import { SendMessageCommand } from './send-message.command';
import { Message, Prisma } from '@prisma/client';

@CommandHandler(SendMessageCommand)
export class SendMessageHandler implements ICommandHandler<SendMessageCommand> {
  private readonly logger = new Logger(SendMessageHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioService: TwilioService,
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

    // Send via Twilio BEFORE persisting (fail-fast)
    let twilioSid: string | undefined;
    if (channel === 'SMS' || channel === 'WHATSAPP') {
      const phone = conversation.contact.phone;
      if (!phone) {
        throw new BadRequestException('Contact has no phone number');
      }

      try {
        if (channel === 'SMS') {
          twilioSid = await this.twilioService.sendSms(phone, content);
        } else {
          await this.twilioService.sendWhatsApp(phone, content);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Twilio send failed, aborting persist: ${msg}`);
        throw err;
      }
    }

    const meta: Record<string, unknown> | undefined = {
      ...(subject ? { subject } : {}),
      ...(twilioSid ? { twilioSid } : {}),
    };
    const metaValue = Object.keys(meta).length > 0 ? meta : undefined;

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          channel,
          direction: 'OUTBOUND',
          content,
          meta: metaValue as Prisma.InputJsonValue | undefined,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), unreadCount: 0 },
      }),
    ]);

    return message;
  }
}
