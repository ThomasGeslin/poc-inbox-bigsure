import { IsString, IsIn, IsNotEmpty, IsOptional } from 'class-validator';

export class StartConversationDto {
  @IsString()
  @IsNotEmpty()
  contactId!: string;

  @IsString()
  @IsIn(['mail', 'sms', 'whatsapp'])
  channel!: 'mail' | 'sms' | 'whatsapp';

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  subject?: string;
}
