import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { SendMessageCommand } from '../commands/send-message.command';
import { UpdateConversationStatusCommand } from '../commands/update-conversation-status.command';
import { MarkAsReadCommand } from '../commands/mark-as-read.command';
import { GetConversationsQuery } from '../queries/get-conversations.query';
import { GetConversationMessagesQuery } from '../queries/get-conversation-messages.query';
import { SendMessageDto } from '../dto/send-message.dto';
import { isAcceptedAttachmentType } from '../utils/attachment.utils';
import { ConversationStatus, Channel, Message } from '@prisma/client';

const CHANNEL_INPUT_MAP: Record<string, Channel> = {
  mail: 'MAIL',
  sms: 'SMS',
  whatsapp: 'WHATSAPP',
  call: 'CALL',
};

const STATUS_INPUT_MAP: Record<string, ConversationStatus> = {
  to_attach: 'A_TRAITER',
  to_plan: 'A_PLANIFIER',
  quote_after_meeting: 'DEVIS_APRES_VISITE',
  waiting: 'EN_ATTENTE',
  treated: 'TRAITE',
};

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  findAll() {
    return this.queryBus.execute(new GetConversationsQuery());
  }

  @Get(':id/messages')
  findMessages(@Param('id') id: string) {
    return this.queryBus.execute(new GetConversationMessagesQuery(id));
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
      fileFilter: (
        _req: unknown,
        file: Express.Multer.File,
        cb: (err: Error | null, accept: boolean) => void,
      ) => {
        cb(null, isAcceptedAttachmentType(file.mimetype));
      },
    }),
  )
  async createMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const channel = CHANNEL_INPUT_MAP[dto.channel];
    const message: Message = await this.commandBus.execute(
      new SendMessageCommand(id, channel, dto.content, dto.subject, files),
    );
    // Normalize to lowercase for frontend consistency (same as query handlers)
    return {
      ...message,
      channel: message.channel.toLowerCase(),
      direction: message.direction.toLowerCase(),
      timestamp:
        message.timestamp instanceof Date
          ? message.timestamp.toISOString()
          : message.timestamp,
    };
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(@Param('id') id: string, @Body('status') statusInput: string) {
    const status = STATUS_INPUT_MAP[statusInput];
    return this.commandBus.execute(
      new UpdateConversationStatusCommand(id, status),
    );
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(@Param('id') id: string) {
    return this.commandBus.execute(new MarkAsReadCommand(id));
  }
}
