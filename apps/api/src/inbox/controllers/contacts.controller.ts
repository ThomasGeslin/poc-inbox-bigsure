import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { UpdateContactCommand } from '../commands/update-contact.command';
import { CreateContactDto } from '../dto/create-contact.dto';
import { CreateContactCommand } from '../commands/create-contact.command';
import { Contact } from '@prisma/client';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  createContact(@Body() dto: CreateContactDto): Promise<Contact> {
    return this.commandBus.execute(new CreateContactCommand(dto));
  }

  @Patch(':id')
  updateContact(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<Contact> {
    return this.commandBus.execute(new UpdateContactCommand(id, dto));
  }
}
