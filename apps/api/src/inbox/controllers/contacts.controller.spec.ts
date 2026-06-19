import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { ContactsController } from './contacts.controller';
import { CreateContactCommand } from '../commands/create-contact.command';
import { UpdateContactCommand } from '../commands/update-contact.command';

describe('ContactsController', () => {
  let controller: ContactsController;
  let commandBus: jest.Mocked<CommandBus>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [
        { provide: CommandBus, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get(ContactsController);
    commandBus = module.get(CommandBus) as jest.Mocked<CommandBus>;
  });

  describe('POST /contacts', () => {
    it('dispatches CreateContactCommand with the full DTO and returns the new contact', async () => {
      const dto = { name: 'Alice', email: 'alice@example.com' };
      const created = { id: 'c-1', ...dto, phone: null, role: null, company: null, createdAt: new Date() };

      (commandBus.execute as jest.Mock).mockResolvedValue(created);

      const result = await controller.createContact(dto as never);

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(CreateContactCommand));
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ data: dto }),
      );
      expect(result).toBe(created);
    });

    it('accepts a contact with phone only (no email)', async () => {
      const dto = { name: 'Bob', phone: '+33612345678' };
      const created = { id: 'c-2', ...dto, email: null, role: null, company: null, createdAt: new Date() };

      (commandBus.execute as jest.Mock).mockResolvedValue(created);

      const result = await controller.createContact(dto as never);

      expect(result).toBe(created);
    });

    it('passes optional role and company fields through', async () => {
      const dto = { name: 'Carol', email: 'carol@corp.fr', role: 'CEO', company: 'Corp SA' };
      (commandBus.execute as jest.Mock).mockResolvedValue({ id: 'c-3', ...dto, phone: null, createdAt: new Date() });

      await controller.createContact(dto as never);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'CEO', company: 'Corp SA' }) }),
      );
    });
  });

  describe('PATCH /contacts/:id', () => {
    it('dispatches UpdateContactCommand with the contact id and partial DTO', async () => {
      const id = 'c-1';
      const dto = { name: 'Alice Updated', phone: '+33611000000' };
      const updated = { id, name: 'Alice Updated', phone: '+33611000000', email: 'a@b.com', role: null, company: null, createdAt: new Date() };

      (commandBus.execute as jest.Mock).mockResolvedValue(updated);

      const result = await controller.updateContact(id, dto as never);

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(UpdateContactCommand));
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: id, data: dto }),
      );
      expect(result).toBe(updated);
    });

    it('allows partial updates (only name, no other fields)', async () => {
      const id = 'c-2';
      const dto = { name: 'New Name' };

      (commandBus.execute as jest.Mock).mockResolvedValue({ id, name: 'New Name', email: null, phone: null, role: null, company: null, createdAt: new Date() });

      await controller.updateContact(id, dto as never);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: id, data: { name: 'New Name' } }),
      );
    });
  });
});
