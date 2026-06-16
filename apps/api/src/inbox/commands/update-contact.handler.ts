import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateContactCommand } from './update-contact.command';
import { Contact } from '@prisma/client';

@CommandHandler(UpdateContactCommand)
export class UpdateContactHandler implements ICommandHandler<UpdateContactCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateContactCommand): Promise<Contact> {
    const { contactId, data } = command;

    const existing = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!existing) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }

    return this.prisma.contact.update({
      where: { id: contactId },
      data,
    });
  }
}
