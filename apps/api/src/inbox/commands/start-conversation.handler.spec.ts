import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { StartConversationHandler } from './start-conversation.handler';
import { StartConversationCommand } from './start-conversation.command';
import { SendMessageCommand } from './send-message.command';

function makePrisma() {
  return {
    contact: { findUnique: jest.fn() },
    conversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  } as unknown as import('../../../prisma/prisma.service').PrismaService;
}

function makeCommandBus() {
  return { execute: jest.fn() } as unknown as CommandBus;
}

const mailContact = {
  id: 'c-1',
  name: 'Alice',
  email: 'alice@example.com',
  phone: null,
  role: null,
  company: null,
  createdAt: new Date(),
};

const serializedConv = {
  id: 'conv-1',
  contactId: 'c-1',
  subject: 'Hello',
  status: 'to_attach',
  channel: 'mail',
  channels: ['mail'],
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  lastMessage: 'Hi there',
  contact: mailContact,
};

describe('StartConversationHandler', () => {
  let handler: StartConversationHandler;
  let prisma: ReturnType<typeof makePrisma>;
  let commandBus: CommandBus;

  beforeEach(() => {
    prisma = makePrisma();
    commandBus = makeCommandBus();
    handler = new StartConversationHandler(prisma, commandBus);
  });

  it('throws NotFound when the contact does not exist', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      handler.execute(
        new StartConversationCommand('missing', 'MAIL', 'Hi', 'Hello'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects MAIL when the contact has no email', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({
      ...mailContact,
      email: null,
    });

    await expect(
      handler.execute(new StartConversationCommand('c-1', 'MAIL', 'Hi')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects SMS when the contact has no phone', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue(mailContact);

    await expect(
      handler.execute(new StartConversationCommand('c-1', 'SMS', 'Hi')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a conversation, sends the first message and returns the serialized conversation', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue(mailContact);
    (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.conversation.create as jest.Mock).mockResolvedValue({
      id: 'conv-1',
    });
    (prisma.conversation.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      ...serializedConv,
      status: 'A_TRAITER',
      channel: 'MAIL',
      lastMessageAt: new Date(),
      messages: [{ content: 'Hi there', channel: 'MAIL' }],
    });

    const result = await handler.execute(
      new StartConversationCommand('c-1', 'MAIL', 'Hi there', 'Hello'),
    );

    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: { contactId: 'c-1', channel: 'MAIL', subject: 'Hello' },
    });
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(SendMessageCommand),
    );
    expect(result).toMatchObject({ id: 'conv-1', contactId: 'c-1' });
  });

  it('reuses an existing open conversation instead of creating a new one', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue(mailContact);
    (prisma.conversation.findFirst as jest.Mock).mockResolvedValue({
      id: 'conv-existing',
    });
    (prisma.conversation.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      ...serializedConv,
      id: 'conv-existing',
      status: 'A_TRAITER',
      channel: 'MAIL',
      lastMessageAt: new Date(),
      messages: [{ content: 'Hi there', channel: 'MAIL' }],
    });

    const result = await handler.execute(
      new StartConversationCommand('c-1', 'MAIL', 'Hi there'),
    );

    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-existing' }),
    );
    expect(result).toMatchObject({ id: 'conv-existing' });
  });
});
