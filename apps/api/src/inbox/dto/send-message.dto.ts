import { IsString, IsIn, IsNotEmpty, IsOptional } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsIn(['mail', 'sms', 'whatsapp', 'call'])
  channel!: 'mail' | 'sms' | 'whatsapp' | 'call';

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  subject?: string;
}
