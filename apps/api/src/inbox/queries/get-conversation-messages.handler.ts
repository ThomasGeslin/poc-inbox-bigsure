import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetConversationMessagesQuery } from './get-conversation-messages.query';
import { serializeMessage } from '../serializers/inbox.serializer';

@QueryHandler(GetConversationMessagesQuery)
export class GetConversationMessagesHandler implements IQueryHandler<GetConversationMessagesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetConversationMessagesQuery) {
    const { conversationId } = query;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
    });

    return messages.map(serializeMessage);
  }
}
