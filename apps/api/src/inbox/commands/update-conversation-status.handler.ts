import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateConversationStatusCommand } from './update-conversation-status.command';
import { Conversation } from '@prisma/client';

@CommandHandler(UpdateConversationStatusCommand)
export class UpdateConversationStatusHandler implements ICommandHandler<UpdateConversationStatusCommand> {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }
}
