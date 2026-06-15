import { ConversationStatus } from '@prisma/client';

export class UpdateConversationStatusCommand {
  constructor(
    public readonly conversationId: string,
    public readonly status: ConversationStatus,
  ) {}
}
