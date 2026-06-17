import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import twilio, { Twilio } from 'twilio';
import { validateRequest } from 'twilio';
import {
  isValidPhoneNumber,
  parsePhoneNumberWithError,
} from 'libphonenumber-js';

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

  /** Send an SMS message via Twilio */
  async sendSms(to: string, body: string): Promise<string> {
    const normalizedTo = this.normalizeE164(to);
    if (!normalizedTo) {
      throw new BadRequestException(`Invalid phone number: ${to}`);
    }

    const from = process.env.TWILIO_SMS_NUMBER;
    if (!from) {
      throw new InternalServerErrorException(
        'TWILIO_SMS_NUMBER is not defined',
      );
    }

    try {
      const result = await this.client.messages.create({
        to: normalizedTo,
        from,
        body,
      });
      return result.sid;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Twilio SMS send failed: ${msg}`);
      throw new InternalServerErrorException(
        `Failed to send SMS via Twilio: ${msg}`,
      );
    }
  }

  /** Send a WhatsApp message via Twilio */
  async sendWhatsApp(to: string, body: string): Promise<string> {
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
      const result = await this.client.messages.create({
        to: toFormatted,
        from,
        body,
      });

      this.logger.log(
        `WhatsApp sent OK — sid=${result.sid} status=${result.status} to=${toFormatted}`,
      );

      return result.sid;
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

  /**
   * Initiate an outbound call from the Twilio number to `to`.
   * Twilio will hit /api/webhooks/twilio/voice for call handling
   * and /api/webhooks/twilio/voice/status when the call ends.
   *
   * Not called automatically in this POC — exposed for future use.
   */
  async initiateCall(to: string, from?: string): Promise<string> {
    const normalizedTo = this.normalizeE164(to);
    if (!normalizedTo) {
      throw new BadRequestException(`Invalid phone number: ${to}`);
    }

    const fromNumber = from ?? process.env.TWILIO_SMS_NUMBER;
    if (!fromNumber) {
      throw new InternalServerErrorException(
        'TWILIO_SMS_NUMBER is not defined',
      );
    }

    const webhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL;
    if (!webhookBaseUrl) {
      throw new InternalServerErrorException(
        'TWILIO_WEBHOOK_BASE_URL is not defined',
      );
    }

    try {
      const call = await this.client.calls.create({
        to: normalizedTo,
        from: fromNumber,
        url: `${webhookBaseUrl}/api/webhooks/twilio/voice`,
        statusCallback: `${webhookBaseUrl}/api/webhooks/twilio/voice/status`,
        statusCallbackMethod: 'POST',
      });

      this.logger.log(
        `Outbound call initiated — sid=${call.sid} to=${normalizedTo}`,
      );

      return call.sid;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Twilio call initiation failed: ${msg}`);
      throw new InternalServerErrorException(
        `Failed to initiate call via Twilio: ${msg}`,
      );
    }
  }

  /** Normalize a phone number to E.164 format */
  normalizeE164(phone: string): string | null {
    try {
      if (isValidPhoneNumber(phone)) {
        return parsePhoneNumberWithError(phone).format('E.164');
      }

      const parsed = parsePhoneNumberWithError(phone, 'FR');

      if (parsed.isValid()) {
        return parsed.format('E.164');
      }

      return null;
    } catch {
      return null;
    }
  }
}
