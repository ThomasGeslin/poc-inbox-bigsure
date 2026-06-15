import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationStatus, Channel } from '@prisma/client';

const STATUS_MAP: Record<ConversationStatus, string> = {
  A_TRAITER: 'to_attach',
  A_PLANIFIER: 'to_plan',
  DEVIS_APRES_VISITE: 'quote_after_meeting',
  EN_ATTENTE: 'waiting',
  TRAITE: 'treated',
};

const CHANNEL_MAP: Record<Channel, string> = {
  MAIL: 'mail',
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  CALL: 'call',
};

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const conversations = await this.prisma.conversation.findMany({
      include: {
        contact: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map((conv) => ({
      id: conv.id,
      contactId: conv.contactId,
      subject: conv.subject,
      status: STATUS_MAP[conv.status],
      channel: CHANNEL_MAP[conv.channel],
      unreadCount: conv.unreadCount,
      lastMessageAt: conv.lastMessageAt.toISOString(),
      lastMessage: conv.messages[0]?.content ?? '',
      contact: {
        id: conv.contact.id,
        name: conv.contact.name,
        email: conv.contact.email,
        phone: conv.contact.phone,
        role: conv.contact.role,
        company: conv.contact.company,
      },
    }));
  }

  async findMessages(conversationId: string) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
    });

    return messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      channel: CHANNEL_MAP[msg.channel],
      direction: msg.direction.toLowerCase() as 'inbound' | 'outbound',
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
      meta: msg.meta ?? undefined,
    }));
  }

  async createMessage(
    conversationId: string,
    dto: { channel: string; content: string; subject?: string },
  ) {
    const channelKey = (
      Object.entries(CHANNEL_MAP) as [Channel, string][]
    ).find(([, v]) => v === dto.channel)?.[0];

    if (!channelKey) throw new Error(`Unknown channel: ${dto.channel}`);

    const meta = dto.subject ? { subject: dto.subject } : undefined;

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          channel: channelKey,
          direction: 'OUTBOUND',
          content: dto.content,
          meta,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), unreadCount: 0 },
      }),
    ]);

    return {
      id: message.id,
      conversationId: message.conversationId,
      channel: CHANNEL_MAP[message.channel],
      direction: 'outbound' as const,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      meta: message.meta ?? undefined,
    };
  }
}
