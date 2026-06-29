export class SendMessageCommand {
  constructor(
    public readonly conversationId: string,
    public readonly channel: 'MAIL' | 'SMS' | 'WHATSAPP' | 'CALL',
    public readonly content: string,
    public readonly subject?: string,
    public readonly attachments?: Express.Multer.File[],
  ) {}
}
