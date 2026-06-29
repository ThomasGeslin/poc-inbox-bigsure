import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetContactsQuery } from './get-contacts.query';
import { Contact } from '@prisma/client';

@QueryHandler(GetContactsQuery)
export class GetContactsHandler implements IQueryHandler<GetContactsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  execute(_query: GetContactsQuery): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      orderBy: { name: 'asc' },
    });
  }
}
