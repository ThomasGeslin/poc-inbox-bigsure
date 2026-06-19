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

function makeResend() {
  return {
    sendEmail: jest.fn().mockResolvedValue('<resend-msg-id@resend.dev>'),
  };
}

describe('SendMessageHandler', () => {
  let handler: SendMessageHandler;
  let prisma: ReturnType<typeof makePrisma>;
  let twilio: ReturnType<typeof makeTwilio>;
  let resend: ReturnType<typeof makeResend>;

  beforeEach(() => {
    prisma = makePrisma();
    twilio = makeTwilio();
    resend = makeResend();
    handler = new SendMessageHandler(prisma, twilio as never, resend as never);
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
    it('sends email via Resend, persists outbound message and returns it', async () => {
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

      expect(resend.sendEmail).toHaveBeenCalledWith(
        EMAIL,
        expect.any(String),
        expect.any(String),
        undefined,
      );
      expect(result).toEqual(message);
    });

    it('threads reply using In-Reply-To when a prior MAIL message has a messageId', async () => {
      const conversation = makeConversation();
      const priorMessage = makeMessage({
        id: 'msg-0',
        channel: 'MAIL',
        meta: { messageId: '<prior@resend.dev>' },
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

      expect(resend.sendEmail).toHaveBeenCalledWith(
        EMAIL,
        expect.any(String),
        expect.any(String),
        { inReplyTo: '<prior@resend.dev>', references: ['<prior@resend.dev>'] },
      );
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

      expect(resend.sendEmail).not.toHaveBeenCalled();
    });

    it('does not persist message when Resend throws', async () => {
      const conversation = makeConversation();

      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
        conversation,
      );
      (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
      resend.sendEmail.mockRejectedValue(new Error('Resend API down'));

      await expect(
        handler.execute(new SendMessageCommand(CONV_ID, 'MAIL', 'Hi')),
      ).rejects.toThrow('Resend API down');

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

      expect(twilio.sendSms).toHaveBeenCalledWith(PHONE, 'Your quote is ready');
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

      expect(twilio.sendWhatsApp).toHaveBeenCalledWith(PHONE, 'Hello on WA');
      expect(twilio.sendSms).not.toHaveBeenCalled();
    });
  });
});
