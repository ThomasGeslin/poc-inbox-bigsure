import { ReceiveInboundMessageHandler } from './receive-inbound-message.handler';
import { ReceiveInboundMessageCommand } from './receive-inbound-message.command';

const PHONE = '+33612345678';

const makeContact = (overrides = {}) => ({
  id: 'contact-1',
  name: PHONE,
  phone: PHONE,
  email: null,
  role: null,
  company: null,
  createdAt: new Date(),
  ...overrides,
});

const makeConversation = (overrides = {}) => ({
  id: 'conv-1',
  contactId: 'contact-1',
  status: 'A_TRAITER' as const,
  channel: 'SMS' as const,
  unreadCount: 0,
  lastMessageAt: new Date(),
  subject: `Conversation with ${PHONE}`,
  createdAt: new Date(),
  ...overrides,
});

const makeMessage = (overrides = {}) => ({
  id: 'msg-1',
  conversationId: 'conv-1',
  channel: 'SMS' as const,
  direction: 'INBOUND' as const,
  content: 'Hello',
  meta: null,
  timestamp: new Date(),
  ...overrides,
});

function makePrisma() {
  const contact = {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  };
  const conversation = {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  };
  const message = {
    create: jest.fn(),
    findMany: jest.fn(),
  };
  const $transaction = jest
    .fn()
    .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

  return {
    contact,
    conversation,
    message,
    $transaction,
  } as unknown as import('../../../prisma/prisma.service').PrismaService;
}

function makeRealtime() {
  return {
    emitMessageCreated: jest.fn(),
    emitConversationUpdated: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ReceiveInboundMessageHandler', () => {
  let handler: ReceiveInboundMessageHandler;
  let prisma: ReturnType<typeof makePrisma>;
  let realtime: ReturnType<typeof makeRealtime>;

  beforeEach(() => {
    prisma = makePrisma();
    realtime = makeRealtime();
    handler = new ReceiveInboundMessageHandler(prisma, realtime);
  });

  describe('first-time inbound from unknown phone number', () => {
    it('creates a contact, opens a new conversation, stores the message and increments unreadCount', async () => {
      const contact = makeContact();
      const conversation = makeConversation();
      const message = makeMessage({ content: 'First ever SMS' });

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.contact.create as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.conversation.create as jest.Mock).mockResolvedValue(conversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(message);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      const result = await handler.execute(
        new ReceiveInboundMessageCommand(PHONE, 'SMS', 'First ever SMS', {}),
      );

      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: { name: PHONE, phone: PHONE },
      });
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId: contact.id,
          channel: 'SMS',
        }),
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(message);
    });
  });

  describe('known contact with an existing open conversation', () => {
    it('reuses the existing conversation without creating a new one', async () => {
      const contact = makeContact();
      const conversation = makeConversation({ unreadCount: 2 });
      const message = makeMessage({ content: 'Follow-up' });

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(message);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new ReceiveInboundMessageCommand(PHONE, 'SMS', 'Follow-up', {}),
      );

      expect(prisma.contact.create).not.toHaveBeenCalled();
      expect(prisma.conversation.create).not.toHaveBeenCalled();
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ unreadCount: { increment: 1 } }),
        }),
      );
    });
  });

  describe('known contact whose only conversation is treated (closed)', () => {
    it('opens a fresh conversation instead of reusing the closed one', async () => {
      const contact = makeContact();
      const newConversation = makeConversation({ id: 'conv-2' });
      const message = makeMessage({ conversationId: 'conv-2' });

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.conversation.create as jest.Mock).mockResolvedValue(
        newConversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(message);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(
        newConversation,
      );

      await handler.execute(
        new ReceiveInboundMessageCommand(PHONE, 'SMS', 'Re-opening', {}),
      );

      expect(prisma.conversation.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('WhatsApp inbound message', () => {
    it('persists the conversation with channel WHATSAPP', async () => {
      const contact = makeContact();

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.contact.create as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.conversation.create as jest.Mock).mockResolvedValue(
        makeConversation({ channel: 'WHATSAPP' }),
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(
        makeMessage({ channel: 'WHATSAPP' }),
      );
      (prisma.conversation.update as jest.Mock).mockResolvedValue(
        makeConversation(),
      );

      await handler.execute(
        new ReceiveInboundMessageCommand(PHONE, 'WHATSAPP', 'Hey on WA', {}),
      );

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ channel: 'WHATSAPP' }),
      });
    });
  });

  describe('message metadata', () => {
    it('passes Twilio metadata through to the message record', async () => {
      const contact = makeContact();
      const conversation = makeConversation();
      const meta = {
        messageSid: 'SM123',
        accountSid: 'AC456',
        numMedia: '0',
        rawFrom: PHONE,
        rawTo: '+33700000000',
      };

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new ReceiveInboundMessageCommand(PHONE, 'SMS', 'With meta', meta),
      );

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ meta }),
        }),
      );
    });
  });
});
