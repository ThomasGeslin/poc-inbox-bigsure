export class UpdateContactCommand {
  constructor(
    public readonly contactId: string,
    public readonly data: {
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
      company?: string;
    },
  ) {}
}
