import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateContactCommand } from './update-contact.command';
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

    const normalized = { ...data, phone: normalizePhone(data.phone) };

    return this.prisma.contact.update({
      where: { id: contactId },
      data: normalized,
    });
  }
}
