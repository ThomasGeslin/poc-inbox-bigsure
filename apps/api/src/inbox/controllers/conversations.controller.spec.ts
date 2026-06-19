import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ConversationsController } from './conversations.controller';
import { GetConversationsQuery } from '../queries/get-conversations.query';
import { GetConversationMessagesQuery } from '../queries/get-conversation-messages.query';
import { SendMessageCommand } from '../commands/send-message.command';
import { UpdateConversationStatusCommand } from '../commands/update-conversation-status.command';
import { MarkAsReadCommand } from '../commands/mark-as-read.command';

const CONV_ID = 'conv-1';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        { provide: CommandBus, useValue: { execute: jest.fn() } },
        { provide: QueryBus, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get(ConversationsController);
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  describe('GET /conversations', () => {
    it('dispatches GetConversationsQuery and returns the result', async () => {
      const conversations = [
        { id: CONV_ID, status: 'to_attach', channel: 'mail' },
      ];
      (queryBus.execute as jest.Mock).mockResolvedValue(conversations);

      const result = await controller.findAll();

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetConversationsQuery),
      );
      expect(result).toBe(conversations);
    });
  });

  describe('GET /conversations/:id/messages', () => {
    it('dispatches GetConversationMessagesQuery with the correct conversation id', async () => {
      const messages = [{ id: 'msg-1', channel: 'mail' }];
      (queryBus.execute as jest.Mock).mockResolvedValue(messages);

      const result = await controller.findMessages(CONV_ID);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: CONV_ID }),
      );
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetConversationMessagesQuery),
      );
      expect(result).toBe(messages);
    });
  });

  describe('POST /conversations/:id/messages', () => {
    const baseMessage = {
      id: 'msg-1',
      conversationId: CONV_ID,
      channel: 'MAIL' as const,
      direction: 'OUTBOUND' as const,
      content: 'Hello',
      meta: null,
      timestamp: new Date('2024-06-01T10:00:00.000Z'),
    };

    it('maps lowercase channel input to Prisma enum and dispatches SendMessageCommand', async () => {
      (commandBus.execute as jest.Mock).mockResolvedValue(baseMessage);

      await controller.createMessage(CONV_ID, {
        channel: 'mail',
        content: 'Hello',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: CONV_ID,
          channel: 'MAIL',
          content: 'Hello',
        }),
      );
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(SendMessageCommand),
      );
    });

    it.each([
      ['mail', 'MAIL'],
      ['sms', 'SMS'],
      ['whatsapp', 'WHATSAPP'],
      ['call', 'CALL'],
    ] as const)('maps channel "%s" → "%s"', async (input, expected) => {
      (commandBus.execute as jest.Mock).mockResolvedValue({
        ...baseMessage,
        channel: expected,
      });

      await controller.createMessage(CONV_ID, {
        channel: input,
        content: 'msg',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ channel: expected }),
      );
    });

    it('normalizes response channel and direction to lowercase', async () => {
      (commandBus.execute as jest.Mock).mockResolvedValue(baseMessage);

      const result = await controller.createMessage(CONV_ID, {
        channel: 'mail',
        content: 'Hello',
      });

      expect(result.channel).toBe('mail');
      expect(result.direction).toBe('outbound');
    });

    it('serializes timestamp to ISO string in the response', async () => {
      (commandBus.execute as jest.Mock).mockResolvedValue(baseMessage);

      const result = await controller.createMessage(CONV_ID, {
        channel: 'mail',
        content: 'Hello',
      });

      expect(result.timestamp).toBe(baseMessage.timestamp.toISOString());
    });
  });

  describe('PATCH /conversations/:id/status', () => {
    it.each([
      ['to_attach', 'A_TRAITER'],
      ['to_plan', 'A_PLANIFIER'],
      ['quote_after_meeting', 'DEVIS_APRES_VISITE'],
      ['waiting', 'EN_ATTENTE'],
      ['treated', 'TRAITE'],
    ] as const)(
      'maps frontend status "%s" → Prisma enum "%s"',
      async (input, expected) => {
        (commandBus.execute as jest.Mock).mockResolvedValue({});

        await controller.updateStatus(CONV_ID, input);

        expect(commandBus.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            conversationId: CONV_ID,
            status: expected,
          }),
        );
        expect(commandBus.execute).toHaveBeenCalledWith(
          expect.any(UpdateConversationStatusCommand),
        );
      },
    );
  });

  describe('PATCH /conversations/:id/read', () => {
    it('dispatches MarkAsReadCommand with the correct conversation id', async () => {
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      await controller.markAsRead(CONV_ID);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: CONV_ID }),
      );
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(MarkAsReadCommand),
      );
    });
  });
});
