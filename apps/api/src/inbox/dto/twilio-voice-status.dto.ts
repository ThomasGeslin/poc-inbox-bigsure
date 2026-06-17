import { IsOptional, IsString } from 'class-validator';

/**
 * Twilio Voice Status Callback payload (application/x-www-form-urlencoded).
 * Sent by Twilio when a call completes, fails, or is not answered.
 * https://www.twilio.com/docs/voice/api/call-resource#status-values
 */
export class TwilioVoiceStatusDto {
  @IsString()
  CallSid!: string;

  /** completed | no-answer | busy | failed | canceled */
  @IsString()
  CallStatus!: string;

  /** Seconds — only present when CallStatus === "completed" */
  @IsOptional()
  @IsString()
  CallDuration?: string;

  /** inbound | outbound-api | outbound-dial */
  @IsString()
  Direction!: string;

  @IsString()
  From!: string;

  @IsString()
  To!: string;

  @IsOptional()
  @IsString()
  RecordingUrl?: string;

  @IsOptional()
  @IsString()
  AccountSid?: string;
}
