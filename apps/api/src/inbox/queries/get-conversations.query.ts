export class GetConversationsQuery {
  constructor(
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
