import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import twilio, { Twilio } from 'twilio';
import { validateRequest } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly client: Twilio;
  private readonly logger = new Logger(TwilioService.name);

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error(
        'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be defined',
      );
    }

    this.client = twilio(accountSid, authToken);
  }

  async sendSms(to: string, body: string): Promise<void> {
    const from = process.env.TWILIO_SMS_NUMBER;
    if (!from) {
      throw new InternalServerErrorException(
        'TWILIO_SMS_NUMBER is not defined',
      );
    }

    try {
      await this.client.messages.create({ to, from, body });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Twilio SMS send failed: ${msg}`);
      throw new InternalServerErrorException(
        `Failed to send SMS via Twilio: ${msg}`,
      );
    }
  }

  async sendWhatsApp(to: string, body: string): Promise<void> {
    const fromRaw = process.env.TWILIO_WHATSAPP_NUMBER;
    if (!fromRaw) {
      throw new InternalServerErrorException(
        'TWILIO_WHATSAPP_NUMBER is not defined',
      );
    }

    const from = fromRaw.startsWith('whatsapp:')
      ? fromRaw
      : `whatsapp:${fromRaw}`;
    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    try {
      await this.client.messages.create({
        to: toFormatted,
        from,
        body,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Twilio WhatsApp send failed: ${msg}`);
      throw new InternalServerErrorException(
        `Failed to send WhatsApp via Twilio: ${msg}`,
      );
    }
  }

  validateSignature(
    authToken: string,
    twilioSignature: string,
    url: string,
    params: Record<string, string>,
  ): boolean {
    return validateRequest(authToken, twilioSignature, url, params);
  }
}
