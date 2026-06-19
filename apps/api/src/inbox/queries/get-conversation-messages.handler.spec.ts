import { NotFoundException } from '@nestjs/common';
import { GetConversationMessagesHandler } from './get-conversation-messages.handler';
import { GetConversationMessagesQuery } from './get-conversation-messages.query';

const CONV_ID = 'conv-1';

const makeDbMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 'msg-1',
  conversationId: CONV_ID,
  channel: 'MAIL' as const,
  direction: 'INBOUND' as const,
  content: 'Hello there',
  meta: null,
  timestamp: new Date('2024-06-01T10:00:00.000Z'),
  ...overrides,
});

function makePrisma(conversation: unknown, messages: unknown[] = []) {
  return {
    conversation: {
      findUnique: jest.fn().mockResolvedValue(conversation),
    },
    message: {
      findMany: jest.fn().mockResolvedValue(messages),
    },
  } as unknown as import('../../../prisma/prisma.service').PrismaService;
}

describe('GetConversationMessagesHandler', () => {
  describe('conversation not found', () => {
    it('throws NotFoundException', async () => {
      const prisma = makePrisma(null, []);
      const handler = new GetConversationMessagesHandler(prisma);

      await expect(
        handler.execute(new GetConversationMessagesQuery('nonexistent')),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('channel normalization', () => {
    it.each([
      ['MAIL', 'mail'],
      ['SMS', 'sms'],
      ['WHATSAPP', 'whatsapp'],
      ['CALL', 'call'],
    ] as const)('maps DB channel %s → %s', async (dbChannel, expected) => {
      const prisma = makePrisma({ id: CONV_ID }, [
        makeDbMessage({ channel: dbChannel }),
      ]);
      const handler = new GetConversationMessagesHandler(prisma);

      const [result] = await handler.execute(
        new GetConversationMessagesQuery(CONV_ID),
      );

      expect(result.channel).toBe(expected);
    });
  });

  describe('direction normalization', () => {
    it('lowercases INBOUND → inbound', async () => {
      const prisma = makePrisma({ id: CONV_ID }, [
        makeDbMessage({ direction: 'INBOUND' }),
      ]);
      const handler = new GetConversationMessagesHandler(prisma);

      const [result] = await handler.execute(
        new GetConversationMessagesQuery(CONV_ID),
      );

      expect(result.direction).toBe('inbound');
    });

    it('lowercases OUTBOUND → outbound', async () => {
      const prisma = makePrisma({ id: CONV_ID }, [
        makeDbMessage({ direction: 'OUTBOUND' }),
      ]);
      const handler = new GetConversationMessagesHandler(prisma);

      const [result] = await handler.execute(
        new GetConversationMessagesQuery(CONV_ID),
      );

      expect(result.direction).toBe('outbound');
    });
  });

  describe('timestamp serialization', () => {
    it('converts Date to ISO string', async () => {
      const ts = new Date('2024-06-01T10:00:00.000Z');
      const prisma = makePrisma({ id: CONV_ID }, [
        makeDbMessage({ timestamp: ts }),
      ]);
      const handler = new GetConversationMessagesHandler(prisma);

      const [result] = await handler.execute(
        new GetConversationMessagesQuery(CONV_ID),
      );

      expect(result.timestamp).toBe(ts.toISOString());
    });
  });

  describe('message ordering', () => {
    it('queries messages ordered by timestamp ASC (oldest first)', async () => {
      const prisma = makePrisma({ id: CONV_ID }, []);
      const handler = new GetConversationMessagesHandler(prisma);

      await handler.execute(new GetConversationMessagesQuery(CONV_ID));

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timestamp: 'asc' },
        }),
      );
    });
  });

  describe('metadata pass-through', () => {
    it('includes message meta when present', async () => {
      const meta = {
        messageId: '<abc@resend.dev>',
        inReplyTo: '<prev@resend.dev>',
      };
      const prisma = makePrisma({ id: CONV_ID }, [makeDbMessage({ meta })]);
      const handler = new GetConversationMessagesHandler(prisma);

      const [result] = await handler.execute(
        new GetConversationMessagesQuery(CONV_ID),
      );

      expect(result.meta).toEqual(meta);
    });

    it('returns undefined meta when DB meta is null', async () => {
      const prisma = makePrisma({ id: CONV_ID }, [
        makeDbMessage({ meta: null }),
      ]);
      const handler = new GetConversationMessagesHandler(prisma);

      const [result] = await handler.execute(
        new GetConversationMessagesQuery(CONV_ID),
      );

      expect(result.meta).toBeUndefined();
    });
  });

  describe('empty conversation', () => {
    it('returns an empty array when conversation has no messages', async () => {
      const prisma = makePrisma({ id: CONV_ID }, []);
      const handler = new GetConversationMessagesHandler(prisma);

      const result = await handler.execute(
        new GetConversationMessagesQuery(CONV_ID),
      );

      expect(result).toEqual([]);
    });
  });
});
