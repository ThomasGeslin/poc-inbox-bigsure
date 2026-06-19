import { CreateContactHandler } from './create-contact.handler';
import { CreateContactCommand } from './create-contact.command';

function makePrisma() {
  return {
    contact: { create: jest.fn() },
  } as unknown as import('../../../prisma/prisma.service').PrismaService;
}

describe('CreateContactHandler', () => {
  let handler: CreateContactHandler;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    handler = new CreateContactHandler(prisma);
  });

  it('creates a contact with email only', async () => {
    const dto = { name: 'Alice', email: 'alice@example.com' };
    const created = {
      id: 'c-1',
      ...dto,
      phone: null,
      role: null,
      company: null,
      createdAt: new Date(),
    };

    (prisma.contact.create as jest.Mock).mockResolvedValue(created);

    const result = await handler.execute(new CreateContactCommand(dto));

    expect(prisma.contact.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual(created);
  });

  it('creates a contact with phone only', async () => {
    const dto = { name: '+33612345678', phone: '+33612345678' };
    const created = {
      id: 'c-2',
      ...dto,
      email: null,
      role: null,
      company: null,
      createdAt: new Date(),
    };

    (prisma.contact.create as jest.Mock).mockResolvedValue(created);

    const result = await handler.execute(new CreateContactCommand(dto));

    expect(prisma.contact.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual(created);
  });

  it('creates a contact with all optional fields', async () => {
    const dto = {
      name: 'Bob Martin',
      email: 'bob@company.fr',
      phone: '+33611000000',
      role: 'Directeur',
      company: 'BTP SARL',
    };
    const created = { id: 'c-3', ...dto, createdAt: new Date() };

    (prisma.contact.create as jest.Mock).mockResolvedValue(created);

    const result = await handler.execute(new CreateContactCommand(dto));

    expect(result).toEqual(created);
  });
});
