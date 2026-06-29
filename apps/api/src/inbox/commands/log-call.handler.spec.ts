import { LogCallHandler } from './log-call.handler';
import { LogCallCommand } from './log-call.command';

const PHONE = '+33612345678';
const FROM = '+33700000000';
const TO = PHONE;
const CALL_SID = 'CAabc123';

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
  channel: 'CALL' as const,
  subject: `Conversation with ${PHONE}`,
  unreadCount: 0,
  lastMessageAt: new Date(),
  createdAt: new Date(),
  ...overrides,
});

const makeMessage = (overrides = {}) => ({
  id: 'msg-1',
  conversationId: 'conv-1',
  channel: 'CALL' as const,
  direction: 'INBOUND' as const,
  content: 'Appel entrant — 2 min 30s',
  meta: null,
  timestamp: new Date(),
  ...overrides,
});

function makePrisma() {
  const contact = { findFirst: jest.fn(), create: jest.fn() };
  const conversation = {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const message = { create: jest.fn() };
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

describe('LogCallHandler', () => {
  let handler: LogCallHandler;
  let prisma: ReturnType<typeof makePrisma>;
  let realtime: ReturnType<typeof makeRealtime>;

  beforeEach(() => {
    prisma = makePrisma();
    realtime = makeRealtime();
    handler = new LogCallHandler(prisma, realtime);
  });

  describe('completed inbound call', () => {
    it('logs the call and does NOT increment unreadCount', async () => {
      const contact = makeContact();
      const conversation = makeConversation();
      const message = makeMessage({ content: 'Appel entrant — 2 min 30s' });

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(message);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new LogCallCommand(
          PHONE,
          'INBOUND',
          CALL_SID,
          'completed',
          150,
          FROM,
          TO,
        ),
      );

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ unreadCount: expect.anything() }),
        }),
      );
    });

    it('formats call duration correctly in the message content', async () => {
      const contact = makeContact();
      const conversation = makeConversation();

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new LogCallCommand(
          PHONE,
          'INBOUND',
          CALL_SID,
          'completed',
          150,
          FROM,
          TO,
        ),
      );

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'Appel entrant — 2 min 30s',
          }),
        }),
      );
    });
  });

  describe('missed inbound call (no-answer)', () => {
    it('increments unreadCount to signal a missed call', async () => {
      const contact = makeContact();
      const conversation = makeConversation({ unreadCount: 0 });

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(
        makeMessage({ content: 'Appel manqué' }),
      );
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new LogCallCommand(
          PHONE,
          'INBOUND',
          CALL_SID,
          'no-answer',
          0,
          FROM,
          TO,
        ),
      );

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ unreadCount: { increment: 1 } }),
        }),
      );
    });

    it('stores "Appel manqué" as the message content', async () => {
      const contact = makeContact();
      const conversation = makeConversation();

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new LogCallCommand(
          PHONE,
          'INBOUND',
          CALL_SID,
          'no-answer',
          0,
          FROM,
          TO,
        ),
      );

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: 'Appel manqué' }),
        }),
      );
    });
  });

  describe('completed outbound call', () => {
    it('does NOT increment unreadCount for outbound calls', async () => {
      const contact = makeContact();
      const conversation = makeConversation();

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(
        makeMessage({ direction: 'OUTBOUND' }),
      );
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new LogCallCommand(
          PHONE,
          'OUTBOUND',
          CALL_SID,
          'completed',
          60,
          FROM,
          TO,
        ),
      );

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ unreadCount: expect.anything() }),
        }),
      );
    });

    it('stores "Appel sortant — 1 min 0s" as message content', async () => {
      const contact = makeContact();
      const conversation = makeConversation();

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new LogCallCommand(
          PHONE,
          'OUTBOUND',
          CALL_SID,
          'completed',
          60,
          FROM,
          TO,
        ),
      );

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'Appel sortant — 1 min 0s',
          }),
        }),
      );
    });
  });

  describe('unanswered outbound call', () => {
    it('stores "Appel sortant — sans réponse" and does not increment unread', async () => {
      const contact = makeContact();
      const conversation = makeConversation();

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new LogCallCommand(
          PHONE,
          'OUTBOUND',
          CALL_SID,
          'no-answer',
          0,
          FROM,
          TO,
        ),
      );

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'Appel sortant — sans réponse',
          }),
        }),
      );
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ unreadCount: expect.anything() }),
        }),
      );
    });
  });

  describe('call from unknown phone number', () => {
    it('creates a contact on the fly before logging the call', async () => {
      const newContact = makeContact({ id: 'contact-new' });
      const conversation = makeConversation({ contactId: 'contact-new' });

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.contact.create as jest.Mock).mockResolvedValue(newContact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.conversation.create as jest.Mock).mockResolvedValue(conversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new LogCallCommand(
          PHONE,
          'INBOUND',
          CALL_SID,
          'completed',
          30,
          FROM,
          TO,
        ),
      );

      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: { name: PHONE, phone: PHONE },
      });
    });
  });

  describe('call with recording URL', () => {
    it('stores the recording URL in message metadata', async () => {
      const contact = makeContact();
      const conversation = makeConversation();
      const recordingUrl = 'https://api.twilio.com/recordings/RE123.mp3';

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new LogCallCommand(
          PHONE,
          'INBOUND',
          CALL_SID,
          'completed',
          90,
          FROM,
          TO,
          recordingUrl,
        ),
      );

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: expect.objectContaining({ recordingUrl }),
          }),
        }),
      );
    });
  });
});
