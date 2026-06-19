export class ReceiveMailCommand {
  constructor(
    public readonly from: string,
    public readonly subject: string,
    public readonly content: string,
    public readonly messageId?: string,
    public readonly inReplyTo?: string,
    public readonly references?: string[],
    public readonly senderName?: string,
  ) {}
}
