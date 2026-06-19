import { NotFoundException } from '@nestjs/common';
import { MarkAsReadHandler } from './mark-as-read.handler';
import { MarkAsReadCommand } from './mark-as-read.command';

const CONV_ID = 'conv-1';

function makePrisma() {
  return {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as import('../../../prisma/prisma.service').PrismaService;
}

describe('MarkAsReadHandler', () => {
  let handler: MarkAsReadHandler;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    handler = new MarkAsReadHandler(prisma);
  });

  it('resets unreadCount to 0 for an existing conversation', async () => {
    const conversation = { id: CONV_ID, unreadCount: 5 };

    (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(
      conversation,
    );
    (prisma.conversation.update as jest.Mock).mockResolvedValue({
      ...conversation,
      unreadCount: 0,
    });

    await handler.execute(new MarkAsReadCommand(CONV_ID));

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: CONV_ID },
      data: { unreadCount: 0 },
    });
  });

  it('throws NotFoundException when conversation does not exist', async () => {
    (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      handler.execute(new MarkAsReadCommand('nonexistent')),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it('returns void on success (no data leakage)', async () => {
    (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
      id: CONV_ID,
    });
    (prisma.conversation.update as jest.Mock).mockResolvedValue({});

    const result = await handler.execute(new MarkAsReadCommand(CONV_ID));

    expect(result).toBeUndefined();
  });
});
