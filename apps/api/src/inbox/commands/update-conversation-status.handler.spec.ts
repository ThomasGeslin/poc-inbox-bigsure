import { NotFoundException } from '@nestjs/common';
import { UpdateConversationStatusHandler } from './update-conversation-status.handler';
import { UpdateConversationStatusCommand } from './update-conversation-status.command';

const CONV_ID = 'conv-1';

function makePrisma() {
  return {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as import('../../../prisma/prisma.service').PrismaService;
}

describe('UpdateConversationStatusHandler', () => {
  let handler: UpdateConversationStatusHandler;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    handler = new UpdateConversationStatusHandler(prisma as never);
  });

  it('throws NotFoundException when conversation does not exist', async () => {
    (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateConversationStatusCommand('nonexistent', 'TRAITE')),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it.each([
    ['A_TRAITER'],
    ['TRAITE'],
    ['A_PLANIFIER'],
    ['EN_ATTENTE'],
    ['DEVIS_APRES_VISITE'],
  ] as const)('updates status to %s', async (status) => {
    const existing = { id: CONV_ID, status: 'A_TRAITER' };
    const updated = { ...existing, status };

    (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.conversation.update as jest.Mock).mockResolvedValue(updated);

    const result = await handler.execute(
      new UpdateConversationStatusCommand(CONV_ID, status),
    );

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: CONV_ID },
      data: { status },
    });
    expect(result).toEqual(updated);
  });
});
