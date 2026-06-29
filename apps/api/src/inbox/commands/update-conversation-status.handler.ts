import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateConversationStatusCommand } from './update-conversation-status.command';
import { Conversation } from '@prisma/client';
import { RealtimeService } from '../../realtime/realtime.service';

@CommandHandler(UpdateConversationStatusCommand)
export class UpdateConversationStatusHandler implements ICommandHandler<UpdateConversationStatusCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async execute(
    command: UpdateConversationStatusCommand,
  ): Promise<Conversation> {
    const { conversationId, status } = command;

    const existing = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!existing) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });

    // Realtime push so the conversation moves between filter tabs live.
    void this.realtime.emitConversationUpdated(conversationId);

    return updated;
  }
}
