import { GetConversationsHandler } from './get-conversations.handler';
import { GetConversationsQuery } from './get-conversations.query';

function makePrisma(conversations: unknown[] = []) {
  return {
    conversation: {
      findMany: jest.fn().mockResolvedValue(conversations),
    },
  } as unknown as import('../../../prisma/prisma.service').PrismaService;
}

const baseContact = {
  id: 'contact-1',
  name: 'Alice Dupont',
  email: 'alice@example.com',
  phone: '+33612345678',
  role: 'Client',
  company: 'ACME',
};

const baseConversation = (overrides: Record<string, unknown> = {}) => ({
  id: 'conv-1',
  contactId: 'contact-1',
  status: 'A_TRAITER' as const,
  channel: 'MAIL' as const,
  subject: 'Project quote',
  unreadCount: 3,
  lastMessageAt: new Date('2024-06-01T10:00:00Z'),
  createdAt: new Date('2024-06-01T09:00:00Z'),
  contact: baseContact,
  messages: [
    { content: 'Please send me a quote', channel: 'MAIL' as const },
    { content: 'Hello', channel: 'MAIL' as const },
  ],
  ...overrides,
});

describe('GetConversationsHandler', () => {
  let handler: GetConversationsHandler;

  describe('status mapping', () => {
    it.each([
      ['A_TRAITER', 'to_attach'],
      ['TRAITE', 'treated'],
      ['A_PLANIFIER', 'to_plan'],
      ['EN_ATTENTE', 'waiting'],
      ['DEVIS_APRES_VISITE', 'quote_after_meeting'],
    ] as const)(
      'maps Prisma status %s → frontend value %s',
      async (prismaStatus, expected) => {
        const prisma = makePrisma([baseConversation({ status: prismaStatus })]);
        handler = new GetConversationsHandler(prisma);

        const [result] = await handler.execute(new GetConversationsQuery());

        expect(result.status).toBe(expected);
      },
    );
  });

  describe('channel mapping', () => {
    it.each([
      ['MAIL', 'mail'],
      ['SMS', 'sms'],
      ['WHATSAPP', 'whatsapp'],
      ['CALL', 'call'],
    ] as const)(
      'maps channel %s → %s for the last message',
      async (prismaChannel, expected) => {
        const prisma = makePrisma([
          baseConversation({
            messages: [{ content: 'msg', channel: prismaChannel }],
          }),
        ]);
        handler = new GetConversationsHandler(prisma);

        const [result] = await handler.execute(new GetConversationsQuery());

        expect(result.channel).toBe(expected);
      },
    );
  });

  describe('distinct channels', () => {
    it('returns deduplicated channels used across all messages in the conversation', async () => {
      const prisma = makePrisma([
        baseConversation({
          messages: [
            { content: 'msg1', channel: 'MAIL' as const },
            { content: 'msg2', channel: 'SMS' as const },
            { content: 'msg3', channel: 'MAIL' as const },
            { content: 'msg4', channel: 'WHATSAPP' as const },
          ],
        }),
      ]);
      handler = new GetConversationsHandler(prisma);

      const [result] = await handler.execute(new GetConversationsQuery());

      expect(result.channels).toEqual(
        expect.arrayContaining(['mail', 'sms', 'whatsapp']),
      );
      expect(result.channels).toHaveLength(3);
    });
  });

  describe('lastMessage', () => {
    it('returns the content of the most recent message (first in desc-sorted array)', async () => {
      const prisma = makePrisma([
        baseConversation({
          messages: [
            { content: 'Latest message', channel: 'MAIL' as const },
            { content: 'Older message', channel: 'MAIL' as const },
          ],
        }),
      ]);
      handler = new GetConversationsHandler(prisma);

      const [result] = await handler.execute(new GetConversationsQuery());

      expect(result.lastMessage).toBe('Latest message');
    });

    it('returns an empty string when there are no messages', async () => {
      const prisma = makePrisma([baseConversation({ messages: [] })]);
      handler = new GetConversationsHandler(prisma);

      const [result] = await handler.execute(new GetConversationsQuery());

      expect(result.lastMessage).toBe('');
    });
  });

  describe('contact fields', () => {
    it('includes flattened contact data in the response', async () => {
      const prisma = makePrisma([baseConversation()]);
      handler = new GetConversationsHandler(prisma);

      const [result] = await handler.execute(new GetConversationsQuery());

      expect(result.contact).toEqual({
        id: baseContact.id,
        name: baseContact.name,
        email: baseContact.email,
        phone: baseContact.phone,
        role: baseContact.role,
        company: baseContact.company,
      });
    });
  });

  describe('lastMessageAt', () => {
    it('serializes lastMessageAt as ISO string', async () => {
      const date = new Date('2024-06-01T10:00:00.000Z');
      const prisma = makePrisma([baseConversation({ lastMessageAt: date })]);
      handler = new GetConversationsHandler(prisma);

      const [result] = await handler.execute(new GetConversationsQuery());

      expect(result.lastMessageAt).toBe(date.toISOString());
    });
  });

  describe('empty database', () => {
    it('returns an empty array when there are no conversations', async () => {
      const prisma = makePrisma([]);
      handler = new GetConversationsHandler(prisma);

      const result = await handler.execute(new GetConversationsQuery());

      expect(result).toEqual([]);
    });
  });

  describe('unreadCount', () => {
    it('passes through unreadCount from the database', async () => {
      const prisma = makePrisma([baseConversation({ unreadCount: 7 })]);
      handler = new GetConversationsHandler(prisma);

      const [result] = await handler.execute(new GetConversationsQuery());

      expect(result.unreadCount).toBe(7);
    });
  });
});
