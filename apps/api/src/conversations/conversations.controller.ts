import { Controller, Get, Post, Body, Param } from '@nestjs/common';
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

  @Post(':id/messages')
  createMessage(
    @Param('id') id: string,
    @Body() body: { channel: string; content: string; subject?: string },
  ) {
    return this.conversationsService.createMessage(id, body);
  }
}
