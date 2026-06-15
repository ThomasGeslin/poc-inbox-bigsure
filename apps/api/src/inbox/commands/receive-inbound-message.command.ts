export class ReceiveInboundMessageCommand {
  constructor(
    public readonly phone: string,
    public readonly channel: 'SMS' | 'WHATSAPP',
    public readonly content: string,
    public readonly meta?: Record<string, unknown>,
  ) {}
}
