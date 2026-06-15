import { Controller, Get, Param } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  findAll() {
    return this.conversationsService.findAll();
  }

  @Get(':id/messages')
  findMessages(@Param('id') id: string) {
    return this.conversationsService.findMessages(id);
  }
}
