import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetConversationsQuery } from './get-conversations.query';
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

@QueryHandler(GetConversationsQuery)
export class GetConversationsHandler implements IQueryHandler<GetConversationsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(_query: GetConversationsQuery) {
    const conversations = await this.prisma.conversation.findMany({
      include: {
        contact: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          select: { content: true, channel: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map((conv) => {
      // Derive distinct channels used across all messages in this conversation
      const distinctChannels = [
        ...new Set(conv.messages.map((mess) => mess.channel)),
      ];

      return {
        id: conv.id,
        contactId: conv.contactId,
        subject: conv.subject,
        status: STATUS_MAP[conv.status],
        // channel = last channel used (first message after desc sort)
        channel: CHANNEL_MAP[conv.messages[0]?.channel ?? conv.channel],
        channels: distinctChannels.map((ch) => CHANNEL_MAP[ch]),
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
      };
    });
  }
}
