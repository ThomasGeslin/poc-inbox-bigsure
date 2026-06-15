import { IsString, IsOptional, IsNumberString } from 'class-validator';

export class TwilioInboundDto {
  @IsString()
  From!: string;

  @IsString()
  To!: string;

  @IsString()
  Body!: string;

  @IsOptional()
  @IsNumberString()
  NumMedia?: string;

  @IsOptional()
  @IsString()
  MessageSid?: string;

  @IsOptional()
  @IsString()
  AccountSid?: string;

  @IsOptional()
  @IsString()
  MessagingServiceSid?: string;

  @IsOptional()
  @IsString()
  ProfileName?: string;
}
