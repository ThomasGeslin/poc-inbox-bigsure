export class CreateContactCommand {
  constructor(
    public readonly data: {
      name: string;
      email?: string;
      phone?: string;
      role?: string;
      company?: string;
    },
  ) {}
}
