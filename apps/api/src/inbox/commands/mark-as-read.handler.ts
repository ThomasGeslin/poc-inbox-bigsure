import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MarkAsReadCommand } from './mark-as-read.command';

@CommandHandler(MarkAsReadCommand)
export class MarkAsReadHandler implements ICommandHandler<MarkAsReadCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: MarkAsReadCommand): Promise<void> {
    const { conversationId } = command;

    const existing = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!existing) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
  }
}
