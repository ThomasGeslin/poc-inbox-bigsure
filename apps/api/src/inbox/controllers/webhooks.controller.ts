import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { TwilioInboundDto } from '../dto/twilio-inbound.dto';
import { TwilioService } from '../services/twilio.service';
import { ReceiveInboundMessageCommand } from '../commands/receive-inbound-message.command';
import { ReceiveMailCommand } from '../commands/receive-mail.command';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly twilioService: TwilioService,
  ) {}

  @Post('twilio/sms')
  @HttpCode(HttpStatus.OK)
  async handleTwilioSms(
    @Body() dto: TwilioInboundDto,
    @Headers('x-twilio-signature') twilioSignature: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      this.logger.error('TWILIO_AUTH_TOKEN is not configured');
      res.status(200).set('Content-Type', 'text/xml').send(this.emptyTwiml());
      return;
    }

    const webhookUrl = this.buildWebhookUrl(req);
    const params = req.body as Record<string, string>;

    this.logger.debug(
      `[twilio/sms] signature=${twilioSignature} url=${webhookUrl} params=${JSON.stringify(params)}`,
    );

    const isValid = this.twilioService.validateSignature(
      authToken,
      twilioSignature ?? '',
      webhookUrl,
      params,
    );

    if (!isValid) {
      this.logger.warn(
        `[twilio/sms] Invalid signature — expected URL: ${webhookUrl} | received signature: ${twilioSignature}`,
      );
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    // SMS-only: normalize From number
    const rawPhone = dto.From;
    const normalizedPhone = this.twilioService.normalizeE164(rawPhone);

    if (!normalizedPhone) {
      this.logger.warn(`Could not normalize phone number: ${rawPhone}`);
      throw new BadRequestException(`Invalid phone number: ${rawPhone}`);
    }

    const meta: Record<string, unknown> = {
      twilioSid: dto.MessageSid,
      accountSid: dto.AccountSid,
      numMedia: dto.NumMedia,
      rawFrom: dto.From,
      rawTo: dto.To,
    };

    await this.commandBus.execute(
      new ReceiveInboundMessageCommand(normalizedPhone, 'SMS', dto.Body, meta),
    );
    this.logger.log(
      `[twilio/sms] Message stored — from=${normalizedPhone} sid=${dto.MessageSid}`,
    );

    res.status(200).set('Content-Type', 'text/xml').send(this.emptyTwiml());
  }

  @Post('twilio/inbound')
  @HttpCode(HttpStatus.OK)
  async handleTwilioInbound(
    @Body() dto: TwilioInboundDto,
    @Headers('x-twilio-signature') twilioSignature: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // --- Twilio signature validation ---
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      this.logger.error('TWILIO_AUTH_TOKEN is not configured');
      res.status(200).set('Content-Type', 'text/xml').send(this.emptyTwiml());
      return;
    }

    const webhookUrl = this.buildWebhookUrl(req);
    const params = req.body as Record<string, string>;

    const isValid = this.twilioService.validateSignature(
      authToken,
      twilioSignature ?? '',
      webhookUrl,
      params,
    );

    if (!isValid) {
      this.logger.warn(
        `Invalid Twilio signature from IP ${req.ip} for URL ${webhookUrl}`,
      );
      throw new BadRequestException('Invalid Twilio signature');
    }

    // --- Channel detection ---
    const from: string = dto.From;
    const isWhatsApp = from.startsWith('whatsapp:');
    const channel: 'SMS' | 'WHATSAPP' = isWhatsApp ? 'WHATSAPP' : 'SMS';

    // --- Phone normalization ---
    const rawPhone = isWhatsApp ? from.replace('whatsapp:', '') : from;
    const normalizedPhone = this.normalizePhone(rawPhone);

    if (!normalizedPhone) {
      this.logger.warn(`Could not normalize phone number: ${rawPhone}`);
      throw new BadRequestException(`Invalid phone number: ${rawPhone}`);
    }

    // --- Dispatch command ---
    const meta: Record<string, unknown> = {
      messageSid: dto.MessageSid,
      accountSid: dto.AccountSid,
      numMedia: dto.NumMedia,
      profileName: dto.ProfileName,
      rawFrom: dto.From,
      rawTo: dto.To,
    };

    await this.commandBus.execute(
      new ReceiveInboundMessageCommand(
        normalizedPhone,
        channel,
        dto.Body,
        meta,
      ),
    );

    // --- Return empty TwiML to prevent Twilio retries ---
    res.status(200).set('Content-Type', 'text/xml').send(this.emptyTwiml());
  }

  // ── Mail inbound ─────────────────────────────────────────────────────────
  // Compatible avec Cloudmailin (JSON Normalized), Mailgun (inbound parse)
  // et les tests manuels via curl.
  // Cloudmailin: configurer l'URL de destination sur https://ton-ngrok/api/webhooks/mail/inbound
  // Format Cloudmailin JSON Normalized → champs: envelope.from, headers.subject,
  // html, plain, headers.message_id, headers.in_reply_to, headers.references

  @Post('mail/inbound')
  @HttpCode(HttpStatus.OK)
  async handleMailInbound(
    @Body()
    body: {
      // Format direct (tests curl / intégrations simples)
      from?: string;
      subject?: string;
      html?: string;
      text?: string;
      messageId?: string;
      inReplyTo?: string;
      references?: string;
      // Format Cloudmailin JSON Normalized
      envelope?: { from?: string; to?: string };
      headers?: {
        subject?: string;
        message_id?: string;
        in_reply_to?: string;
        references?: string;
        // Mailgun uses these names too
        'Message-Id'?: string;
        'In-Reply-To'?: string;
        References?: string;
      };
      plain?: string;
    },
  ): Promise<{ received: boolean }> {
    // Log raw body for debugging provider format
    this.logger.debug(`Mail inbound raw body: ${JSON.stringify(body)}`);

    if (!body || typeof body !== 'object') {
      this.logger.error(`Unexpected body type: ${typeof body}`);
      throw new BadRequestException('Unexpected body format');
    }

    // Normalize fields across providers
    const from = body.from ?? body.envelope?.from ?? '';

    if (!from) {
      throw new BadRequestException('Missing required field: from');
    }

    const subject = body.subject ?? body.headers?.subject ?? '(sans objet)';

    const content = body.html ?? body.text ?? body.plain ?? '';

    const messageId =
      body.messageId ??
      body.headers?.message_id ??
      body.headers?.['Message-Id'];

    const inReplyTo =
      body.inReplyTo ??
      body.headers?.in_reply_to ??
      body.headers?.['In-Reply-To'];

    const referencesRaw =
      body.references ?? body.headers?.references ?? body.headers?.References;

    const references = referencesRaw
      ? referencesRaw.split(/\s+/).filter(Boolean)
      : undefined;

    await this.commandBus.execute(
      new ReceiveMailCommand(
        from,
        subject,
        content,
        messageId,
        inReplyTo,
        references,
      ),
    );

    return { received: true };
  }

  private normalizePhone(raw: string): string | null {
    try {
      if (isValidPhoneNumber(raw)) {
        return parsePhoneNumber(raw).format('E.164');
      }
      // Try with default region as fallback
      const parsed = parsePhoneNumber(raw, 'FR');
      if (parsed.isValid()) {
        return parsed.format('E.164');
      }
      return null;
    } catch {
      return null;
    }
  }

  private buildWebhookUrl(req: Request): string {
    const host =
      process.env.TWILIO_WEBHOOK_BASE_URL ??
      process.env.APP_PUBLIC_URL ??
      `${req.protocol}://${req.get('host')}`;
    return `${host}${req.originalUrl}`;
  }

  private emptyTwiml(): string {
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }
}
