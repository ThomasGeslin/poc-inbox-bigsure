import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SendMessageHandler } from './send-message.handler';
import { SendMessageCommand } from './send-message.command';

const CONV_ID = 'conv-1';
const CONTACT_ID = 'contact-1';
const EMAIL = 'client@example.com';
const PHONE = '+33612345678';

const makeContact = (overrides = {}) => ({
  id: CONTACT_ID,
  name: 'Client',
  email: EMAIL,
  phone: PHONE,
  role: null,
  company: null,
  createdAt: new Date(),
  ...overrides,
});

const makeConversation = (overrides = {}) => ({
  id: CONV_ID,
  contactId: CONTACT_ID,
  status: 'A_TRAITER' as const,
  channel: 'MAIL' as const,
  subject: 'Quote for bathroom renovation',
  unreadCount: 0,
  lastMessageAt: new Date(),
  createdAt: new Date(),
  contact: makeContact(),
  ...overrides,
});

const makeMessage = (overrides = {}) => ({
  id: 'msg-1',
  conversationId: CONV_ID,
  channel: 'MAIL' as const,
  direction: 'OUTBOUND' as const,
  content: 'Hello!',
  meta: null,
  timestamp: new Date(),
  ...overrides,
});

function makePrisma() {
  return {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as import('../../../prisma/prisma.service').PrismaService;
}

function makeTwilio() {
  return {
    sendSms: jest.fn().mockResolvedValue(undefined),
    sendWhatsApp: jest.fn().mockResolvedValue(undefined),
    initiateCall: jest.fn(),
    validateSignature: jest.fn(),
    normalizeE164: jest.fn(),
  };
}

const DEFAULT_FROM = 'plomberie-bigsur@batibig.com';

function makeGraph() {
  return {
    defaultFrom: DEFAULT_FROM,
    sendEmail: jest.fn().mockResolvedValue('<sent-msg-id@poc-inbox>'),
    replyToMessage: jest.fn().mockResolvedValue('<reply-msg-id@poc-inbox>'),
  };
}

const STORAGE_URL =
  'https://project.supabase.co/storage/v1/object/public/attachments/file.jpg';

function makeStorage() {
  return {
    upload: jest.fn().mockResolvedValue(STORAGE_URL),
  };
}

describe('SendMessageHandler', () => {
  let handler: SendMessageHandler;
  let prisma: ReturnType<typeof makePrisma>;
  let twilio: ReturnType<typeof makeTwilio>;
  let graph: ReturnType<typeof makeGraph>;
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    prisma = makePrisma();
    twilio = makeTwilio();
    graph = makeGraph();
    storage = makeStorage();
    handler = new SendMessageHandler(
      prisma,
      twilio as never,
      graph as never,
      storage as never,
    );
  });

  describe('conversation not found', () => {
    it('throws NotFoundException', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler.execute(new SendMessageCommand(CONV_ID, 'MAIL', 'Hi')),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('MAIL channel', () => {
    it('sends a new email via Graph, persists outbound message and returns it', async () => {
      const conversation = makeConversation();
      const message = makeMessage({ content: 'Hi there', channel: 'MAIL' });

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.message.create as jest.Mock).mockResolvedValue(message);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      const result = await handler.execute(
        new SendMessageCommand(CONV_ID, 'MAIL', 'Hi there'),
      );

      expect(graph.sendEmail).toHaveBeenCalledWith(
        EMAIL,
        expect.any(String),
        expect.any(String),
        { attachments: undefined },
      );
      expect(graph.replyToMessage).not.toHaveBeenCalled();
      expect(result).toEqual(message);
    });

    it('threads via Graph createReply when a prior MAIL message has a graphId', async () => {
      const conversation = makeConversation();
      const priorMessage = makeMessage({
        id: 'msg-0',
        channel: 'MAIL',
        meta: { messageId: '<prior@poc-inbox>', graphId: 'graph-msg-123' },
      });

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(priorMessage);
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'MAIL', 'Reply text'),
      );

      expect(graph.replyToMessage).toHaveBeenCalledWith(
        DEFAULT_FROM,
        'graph-msg-123',
        expect.any(String),
        undefined,
      );
      expect(graph.sendEmail).not.toHaveBeenCalled();
    });

    it('persists the replied-to graphId so consecutive replies keep threading', async () => {
      const conversation = makeConversation();
      const priorMessage = makeMessage({
        id: 'msg-0',
        channel: 'MAIL',
        meta: { messageId: '<prior@poc-inbox>', graphId: 'graph-msg-123' },
      });

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(priorMessage);
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'MAIL', 'Reply text'),
      );

      const createArg = (prisma.message.create as jest.Mock).mock.calls[0][0];
      expect(createArg.data.meta).toMatchObject({ graphId: 'graph-msg-123' });
    });

    it('falls back to a new email when the prior MAIL message has no graphId', async () => {
      const conversation = makeConversation();
      const priorMessage = makeMessage({
        id: 'msg-0',
        channel: 'MAIL',
        meta: { messageId: '<prior@poc-inbox>' },
      });

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(priorMessage);
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'MAIL', 'Reply text'),
      );

      expect(graph.sendEmail).toHaveBeenCalled();
      expect(graph.replyToMessage).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when contact has no email', async () => {
      const conversation = makeConversation({
        contact: makeContact({ email: null }),
      });

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );

      await expect(
        handler.execute(new SendMessageCommand(CONV_ID, 'MAIL', 'Hi')),
      ).rejects.toThrow(InternalServerErrorException);

      expect(graph.sendEmail).not.toHaveBeenCalled();
    });

    it('does not persist message when Graph send throws', async () => {
      const conversation = makeConversation();

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      graph.sendEmail.mockRejectedValue(new Error('Graph API down'));

      await expect(
        handler.execute(new SendMessageCommand(CONV_ID, 'MAIL', 'Hi')),
      ).rejects.toThrow('Graph API down');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('SMS channel', () => {
    it('sends SMS via Twilio and persists the outbound message', async () => {
      const conversation = makeConversation({
        channel: 'SMS',
        contact: makeContact(),
      });
      const message = makeMessage({ channel: 'SMS' });

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(message);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'SMS', 'Your quote is ready'),
      );

      expect(twilio.sendSms).toHaveBeenCalledWith(
        PHONE,
        'Your quote is ready',
        undefined,
      );
      expect(twilio.sendWhatsApp).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when contact has no phone', async () => {
      const conversation = makeConversation({
        channel: 'SMS',
        contact: makeContact({ phone: null }),
      });

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );

      await expect(
        handler.execute(new SendMessageCommand(CONV_ID, 'SMS', 'Hi')),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('does not persist message when Twilio SMS send fails', async () => {
      const conversation = makeConversation({ contact: makeContact() });

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      twilio.sendSms.mockRejectedValue(new Error('Twilio error'));

      await expect(
        handler.execute(new SendMessageCommand(CONV_ID, 'SMS', 'Hi')),
      ).rejects.toThrow('Twilio error');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('WhatsApp channel', () => {
    it('sends WhatsApp message via Twilio', async () => {
      const conversation = makeConversation({
        channel: 'WHATSAPP',
        contact: makeContact(),
      });
      const message = makeMessage({ channel: 'WHATSAPP' });

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(message);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'WHATSAPP', 'Hello on WA'),
      );

      expect(twilio.sendWhatsApp).toHaveBeenCalledWith(
        PHONE,
        'Hello on WA',
        undefined,
      );
      expect(twilio.sendSms).not.toHaveBeenCalled();
    });
  });

  describe('subject backfill', () => {
    it('backfills the conversation subject when it was previously blank', async () => {
      const conversation = makeConversation({ subject: '' });
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'MAIL', 'Hi', 'New subject'),
      );

      const updateArg = (prisma.conversation.update as jest.Mock).mock
        .calls[0][0];
      expect(updateArg.data).toMatchObject({ subject: 'New subject' });
    });

    it('does NOT overwrite an existing conversation subject', async () => {
      const conversation = makeConversation({ subject: 'Existing subject' });
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'MAIL', 'Hi', 'New subject'),
      );

      const updateArg = (prisma.conversation.update as jest.Mock).mock
        .calls[0][0];
      expect(updateArg.data.subject).toBeUndefined();
    });
  });

  describe('attachments', () => {
    const makeFile = (overrides: Partial<Express.Multer.File> = {}) =>
      ({
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('image-bytes'),
        ...overrides,
      }) as Express.Multer.File;

    it('forwards attachments to Graph when sending a new email', async () => {
      const conversation = makeConversation();
      const files = [
        makeFile(),
        makeFile({ originalname: 'doc.pdf', mimetype: 'application/pdf' }),
      ];

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'MAIL', 'Hi', undefined, files),
      );

      expect(graph.sendEmail).toHaveBeenCalledWith(
        EMAIL,
        expect.any(String),
        expect.any(String),
        { attachments: files },
      );
    });

    it('forwards attachments to the Graph reply when threading', async () => {
      const conversation = makeConversation();
      const priorMessage = makeMessage({
        id: 'msg-0',
        channel: 'MAIL',
        meta: { messageId: '<prior@poc-inbox>', graphId: 'graph-msg-123' },
      });
      const files = [makeFile()];

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(priorMessage);
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMessage());
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'MAIL', 'Reply', undefined, files),
      );

      expect(graph.replyToMessage).toHaveBeenCalledWith(
        DEFAULT_FROM,
        'graph-msg-123',
        expect.any(String),
        files,
      );
    });

    it('uploads attachments and sends WhatsApp with absolute media URLs', async () => {
      const conversation = makeConversation({
        channel: 'WHATSAPP',
        contact: makeContact(),
      });
      const files = [makeFile()];

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(
        makeMessage({ channel: 'WHATSAPP' }),
      );
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'WHATSAPP', 'Photo', undefined, files),
      );

      // The attachment is uploaded to storage…
      expect(storage.upload).toHaveBeenCalledWith(
        files[0].buffer,
        'image/jpeg',
        'jpg',
      );
      // …and its public URL is passed to Twilio as the WhatsApp media URL.
      expect(twilio.sendWhatsApp).toHaveBeenCalledWith(PHONE, 'Photo', [
        STORAGE_URL,
      ]);
    });

    it('persists media URLs in the outbound message meta', async () => {
      const conversation = makeConversation({
        channel: 'WHATSAPP',
        contact: makeContact(),
      });
      const files = [makeFile()];

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.create as jest.Mock).mockResolvedValue(
        makeMessage({ channel: 'WHATSAPP' }),
      );
      (prisma.conversation.update as jest.Mock).mockResolvedValue(conversation);

      await handler.execute(
        new SendMessageCommand(CONV_ID, 'WHATSAPP', 'Photo', undefined, files),
      );

      const createArg = (prisma.message.create as jest.Mock).mock.calls[0][0];
      expect(createArg.data.meta.mediaUrls).toEqual([STORAGE_URL]);
    });
  });
});
