import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetConversationsQuery } from './get-conversations.query';
import {
  CONVERSATION_INCLUDE,
  serializeConversation,
} from '../serializers/inbox.serializer';

@QueryHandler(GetConversationsQuery)
export class GetConversationsHandler implements IQueryHandler<GetConversationsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(_query: GetConversationsQuery) {
    const conversations = await this.prisma.conversation.findMany({
      include: CONVERSATION_INCLUDE,
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map(serializeConversation);
  }
}
