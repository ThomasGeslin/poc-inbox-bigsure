import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  Res,
  Query,
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
import { TwilioVoiceStatusDto } from '../dto/twilio-voice-status.dto';
import { TwilioService } from '../services/twilio.service';
import { ReceiveInboundMessageCommand } from '../commands/receive-inbound-message.command';
import { ReceiveMailCommand } from '../commands/receive-mail.command';
import { LogCallCommand, CallLogStatus } from '../commands/log-call.command';
import { MsGraphMailService } from '../services/ms-graph-mail.service';
import { MsGraphNotificationPayload } from '../dto/ms-graph-notification.dto';
import { stripQuotedReply } from '../utils/mail-content.utils';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly twilioService: TwilioService,
    private readonly msGraphMailService: MsGraphMailService,
  ) {}

  /** Handle incoming SMS messages from Twilio */
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

  /** Handle incoming messages from Twilio (SMS or WhatsApp) */
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

  // ── Microsoft Graph mail notifications ───────────────────────────────────
  // Graph sends a POST to this endpoint for two scenarios:
  //  1. Subscription validation: query param ?validationToken=<token> present
  //     → respond 200 text/plain with the token verbatim
  //  2. New message notification: body contains { value: [...] }
  //     → fetch full message from Graph, dispatch ReceiveMailCommand
  @Post('ms-graph/mail')
  async handleMsGraphMail(
    @Query('validationToken') validationToken: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    // ── Subscription validation handshake ──────────────────────────────
    if (validationToken) {
      this.logger.log('Graph subscription validation handshake received');
      res.status(200).type('text/plain').send(validationToken);
      return;
    }

    // ── Notification payload ────────────────────────────────────────────
    const payload = body as MsGraphNotificationPayload;
    if (!payload?.value?.length) {
      res.status(202).send();
      return;
    }

    const expectedSecret =
      process.env.MS_GRAPH_WEBHOOK_SECRET ?? 'poc-inbox-secret';

    // Deduplicate within the same payload batch (Graph can repeat items)
    const seenIds = new Set<string>();

    for (const item of payload.value) {
      if (item.clientState !== expectedSecret) {
        this.logger.warn(
          `Graph notification ignored — invalid clientState (subscriptionId=${item.subscriptionId})`,
        );
        continue;
      }

      // resource: "Users/{objectId-or-upn}/Messages/{messageId}"  (case varies)
      const resourceMatch = item.resource?.match(
        /^users\/([^/]+)\/.*\/([^/]+)$/i,
      );
      const mailbox = resourceMatch?.[1];
      // Prefer resourceData.id, fall back to last segment of the resource URL
      const graphMessageId = item.resourceData?.id ?? resourceMatch?.[2];

      if (!graphMessageId || !mailbox) {
        this.logger.warn(
          `Graph notification missing messageId or mailbox — resource=${item.resource}`,
        );
        continue;
      }

      if (seenIds.has(graphMessageId)) {
        this.logger.debug(
          `Duplicate Graph notification skipped — messageId=${graphMessageId}`,
        );
        continue;
      }
      seenIds.add(graphMessageId);

      // Process asynchronously — respond immediately to Graph (< 3 s required)
      void this.processMsGraphMailNotification(mailbox, graphMessageId);
    }

    res.status(202).send();
  }

  private async processMsGraphMailNotification(
    mailbox: string,
    graphMessageId: string,
  ): Promise<void> {
    try {
      const message = await this.msGraphMailService.getMessage(
        mailbox,
        graphMessageId,
      );

      const from = message.from.emailAddress.address;
      const senderName = message.from.emailAddress.name || undefined;
      const subject = message.subject ?? '(sans objet)';
      // Drop the quoted reply chain — sender/subject/thread are already shown
      // elsewhere in the inbox, so the embedded original message is noise.
      const content = stripQuotedReply(message.body?.content ?? '');

      const headers = message.internetMessageHeaders ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

      // Prefer the RFC From header which always contains the real email address.
      // message.from.emailAddress.address can be an Azure Object ID for internal users.
      const rawFromHeader = getHeader('from') ?? '';
      const fromHeaderMatch = rawFromHeader.match(/<([^>]+)>/);
      const resolvedFrom = fromHeaderMatch?.[1] ?? from;

      // Extract display name from the RFC From header (e.g. "John Doe <john@example.com>")
      const fromHeaderNameMatch = rawFromHeader.match(/^"?([^"<]+?)"?\s*</);
      const resolvedSenderName = fromHeaderNameMatch?.[1]?.trim() || senderName;

      const internetMessageId = message.internetMessageId;
      const inReplyTo = getHeader('In-Reply-To');
      const referencesRaw = getHeader('References');
      const references = referencesRaw
        ? referencesRaw.split(/\s+/).filter(Boolean)
        : undefined;

      await this.commandBus.execute(
        new ReceiveMailCommand(
          resolvedFrom,
          subject,
          content,
          internetMessageId,
          inReplyTo,
          references,
          resolvedSenderName,
          graphMessageId,
        ),
      );

      this.logger.log(
        `[ms-graph/mail] Message stored — from=${resolvedFrom} subject="${subject}"`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to process Graph mail notification (messageId=${graphMessageId}): ${String(err)}`,
      );
    }
  }

  // ── Twilio Voice inbound ─────────────────────────────────────────────────
  // Triggered immediately when a call arrives on the Twilio number.
  // Responds with TwiML to forward the call to TWILIO_FORWARD_NUMBER.
  // The Message is NOT persisted here — we wait for the status callback.
  @Post('twilio/voice')
  @HttpCode(HttpStatus.OK)
  handleTwilioVoice(@Res() res: Response): void {
    const forwardNumber = process.env.TWILIO_FORWARD_NUMBER;

    if (!forwardNumber) {
      this.logger.error('TWILIO_FORWARD_NUMBER is not configured');
      // Return an empty TwiML so the call isn't left hanging
      res.status(200).set('Content-Type', 'text/xml').send(this.emptyTwiml());
      return;
    }

    this.logger.log(
      `[twilio/voice] Incoming call — forwarding to ${forwardNumber}`,
    );

    const twiml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      '  <Dial>',
      `    <Number>${forwardNumber}</Number>`,
      '  </Dial>',
      '</Response>',
    ].join('\n');

    res.status(200).set('Content-Type', 'text/xml').send(twiml);
  }

  // ── Twilio Voice status callback ─────────────────────────────────────────
  // Triggered when a call ends (completed / no-answer / busy / failed).
  // This is where we persist the call log in the conversation thread.
  @Post('twilio/voice/status')
  @HttpCode(HttpStatus.OK)
  async handleTwilioVoiceStatus(
    @Body() dto: TwilioVoiceStatusDto,
    @Headers('x-twilio-signature') twilioSignature: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // ── Signature validation ────────────────────────────────────────────
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      this.logger.error('TWILIO_AUTH_TOKEN is not configured');
      res.status(200).send();
      return;
    }

    const webhookUrl = this.buildWebhookUrl(req);
    const params = req.body as Record<string, string>;

    this.logger.debug(
      `[twilio/voice/status] signature=${twilioSignature} url=${webhookUrl}`,
    );

    const isValid = this.twilioService.validateSignature(
      authToken,
      twilioSignature ?? '',
      webhookUrl,
      params,
    );

    if (!isValid) {
      this.logger.warn(
        `[twilio/voice/status] Invalid signature — url=${webhookUrl}`,
      );
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    // ── Direction normalization ────────────────────────────────────────
    const direction: 'INBOUND' | 'OUTBOUND' = dto.Direction.startsWith(
      'outbound',
    )
      ? 'OUTBOUND'
      : 'INBOUND';

    // ── Contact phone (caller for inbound, callee for outbound) ─────────
    const rawPhone = direction === 'INBOUND' ? dto.From : dto.To;
    const normalizedPhone = this.twilioService.normalizeE164(rawPhone);

    if (!normalizedPhone) {
      this.logger.warn(
        `[twilio/voice/status] Could not normalize phone: ${rawPhone}`,
      );
      throw new BadRequestException(`Invalid phone number: ${rawPhone}`);
    }

    // ── Normalize From / To for meta ────────────────────────────────────
    const normalizedFrom =
      this.twilioService.normalizeE164(dto.From) ?? dto.From;

    const normalizedTo = this.twilioService.normalizeE164(dto.To) ?? dto.To;

    // ── Status mapping ──────────────────────────────────────────────────
    const duration = dto.CallDuration ? parseInt(dto.CallDuration, 10) : 0;
    let status: CallLogStatus;

    if (dto.CallStatus === 'completed' && duration > 0) {
      status = 'completed';
    } else if (dto.CallStatus === 'no-answer' || dto.CallStatus === 'busy') {
      status = 'no-answer';
    } else if (dto.CallStatus === 'failed' || dto.CallStatus === 'canceled') {
      status = 'failed';
    } else {
      // completed with duration 0 → treat as no-answer
      status = 'no-answer';
    }

    await this.commandBus.execute(
      new LogCallCommand(
        normalizedPhone,
        direction,
        dto.CallSid,
        status,
        duration,
        normalizedFrom,
        normalizedTo,
        dto.RecordingUrl,
      ),
    );

    this.logger.log(
      `[twilio/voice/status] Call logged — sid=${dto.CallSid} direction=${direction} status=${status}`,
    );

    res.status(200).send();
  }

  /********************/
  /** Utils functions */
  /********************/
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
