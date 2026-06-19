import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateContactCommand } from './create-contact.command';
import { Contact } from '@prisma/client';
import {
  parsePhoneNumberWithError,
  isValidPhoneNumber,
} from 'libphonenumber-js';

function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return phone;
  try {
    if (isValidPhoneNumber(phone))
      return parsePhoneNumberWithError(phone).format('E.164');

    const parsed = parsePhoneNumberWithError(phone, 'FR');
    if (parsed.isValid()) return parsed.format('E.164');
  } catch {
    console.error(`Failed to normalize phone number: ${phone}`);
  }
  return phone;
}

@CommandHandler(CreateContactCommand)
export class CreateContactHandler implements ICommandHandler<CreateContactCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateContactCommand): Promise<Contact> {
    const data = { ...command.data, phone: normalizePhone(command.data.phone) };
    return this.prisma.contact.create({ data });
  }
}
