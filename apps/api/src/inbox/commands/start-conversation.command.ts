import { Channel } from '@prisma/client';

export class StartConversationCommand {
  constructor(
    public readonly contactId: string,
    public readonly channel: Channel,
    public readonly content: string,
    public readonly subject?: string,
    public readonly attachments?: Express.Multer.File[],
  ) {}
}
