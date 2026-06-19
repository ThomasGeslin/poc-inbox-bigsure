import { ReceiveMailHandler } from './receive-mail.handler';
import { ReceiveMailCommand } from './receive-mail.command';

const EMAIL = 'john.doe@example.com';
const SUBJECT = 'Project quote request';
const CONTENT = '<p>Hello, I need a quote.</p>';

const makeContact = (overrides = {}) => ({
  id: 'contact-1',
  name: 'john.doe',
  email: EMAIL,
  phone: null,
  role: null,
  company: null,
  createdAt: new Date(),
  ...overrides,
});

const makeConversation = (overrides = {}) => ({
  id: 'conv-1',
  contactId: 'contact-1',
  status: 'A_TRAITER' as const,
  channel: 'MAIL' as const,
  subject: SUBJECT,
  unreadCount: 0,
  lastMessageAt: new Date(),
  createdAt: new Date(),
  ...overrides,
});

const makeMessage = (overrides = {}) => ({
  id: 'msg-1',
  conversationId: 'conv-1',
  channel: 'MAIL' as const,
  direction: 'INBOUND' as const,
  content: CONTENT,
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
  const message = {
    findFirst: jest.fn(),
    create: jest.fn(),
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

describe('ReceiveMailHandler', () => {
  let handler: ReceiveMailHandler;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    handler = new ReceiveMailHandler(prisma);
  });

  describe('first email from an unknown sender', () => {
    it('creates a contact from the email, opens a new conversation and stores the message', async () => {
      const contact = makeContact();
      const conversation = makeConversation();
      const message = makeMessage();

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.contact.create as jest.Mock).mockResolvedValue(contact);
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.conversation.create as jest.Mock).mockResolvedValue(conversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(message);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      const result = await handler.execute(
        new ReceiveMailCommand(EMAIL, SUBJECT, CONTENT),
      );

      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: { name: 'john.doe', email: EMAIL },
      });
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId: contact.id,
          channel: 'MAIL',
          subject: SUBJECT,
        }),
      });
      expect(result).toEqual(message);
    });
  });

  describe('reply to an existing thread (In-Reply-To header)', () => {
    it('matches conversation via threading metadata and does not create a new one', async () => {
      const contact = makeContact();
      const conversation = makeConversation();
      const priorMessage = makeMessage({
        id: 'msg-0',
        meta: { messageId: '<prior@resend.dev>' },
        conversation,
      });

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(priorMessage);
      (prisma.message.create as jest.Mock).mockResolvedValue(
        makeMessage({ id: 'msg-1' }),
      );
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new ReceiveMailCommand(
          EMAIL,
          'Re: ' + SUBJECT,
          CONTENT,
          '<reply@resend.dev>',
          '<prior@resend.dev>',
          ['<prior@resend.dev>'],
        ),
      );

      expect(prisma.conversation.create).not.toHaveBeenCalled();
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ conversationId: conversation.id }),
        }),
      );
    });
  });

  describe('reply matched by subject when no threading info', () => {
    it('finds the open conversation with a matching subject', async () => {
      const contact = makeContact();
      const conversation = makeConversation({ subject: SUBJECT });

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      // First findFirst is for threading (no match), second is for subject match
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValueOnce(
        conversation,
      ); // subject match
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new ReceiveMailCommand(EMAIL, 'Re: ' + SUBJECT, CONTENT),
      );

      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });
  });

  describe('email with no match at all (no thread, no subject, no open conversation)', () => {
    it('creates a brand-new conversation', async () => {
      const contact = makeContact();
      const newConversation = makeConversation({
        id: 'conv-new',
        subject: 'Completely new topic',
      });

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.conversation.create as jest.Mock).mockResolvedValue(
        newConversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(
        newConversation,
      );

      await handler.execute(
        new ReceiveMailCommand(EMAIL, 'Completely new topic', CONTENT),
      );

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId: contact.id,
          channel: 'MAIL',
          subject: 'Completely new topic',
        }),
      });
    });
  });

  describe('message metadata (messageId, inReplyTo, references)', () => {
    it('stores threading headers in message meta for future reply matching', async () => {
      const contact = makeContact();
      const conversation = makeConversation();

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new ReceiveMailCommand(
          EMAIL,
          SUBJECT,
          CONTENT,
          '<new-msg-id@example.com>',
          '<replied-msg@example.com>',
          ['<replied-msg@example.com>', '<older@example.com>'],
        ),
      );

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: expect.objectContaining({
              messageId: '<new-msg-id@example.com>',
              inReplyTo: '<replied-msg@example.com>',
              references: ['<replied-msg@example.com>', '<older@example.com>'],
            }),
          }),
        }),
      );
    });
  });

  describe('unread count', () => {
    it('increments unreadCount on every inbound email', async () => {
      const contact = makeContact();
      const conversation = makeConversation({ unreadCount: 1 });

      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(contact);
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(new ReceiveMailCommand(EMAIL, SUBJECT, CONTENT));

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ unreadCount: { increment: 1 } }),
        }),
      );
    });
  });
});
