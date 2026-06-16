import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { UpdateContactCommand } from '../commands/update-contact.command';
import { Contact } from '@prisma/client';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id')
  updateContact(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<Contact> {
    return this.commandBus.execute(new UpdateContactCommand(id, dto));
  }
}
