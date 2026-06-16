import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateContactCommand } from './create-contact.command';
import { Contact } from '@prisma/client';

@CommandHandler(CreateContactCommand)
export class CreateContactHandler implements ICommandHandler<CreateContactCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateContactCommand): Promise<Contact> {
    return this.prisma.contact.create({ data: command.data });
  }
}
