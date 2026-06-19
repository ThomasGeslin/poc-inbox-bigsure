import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { WebhooksController } from './webhooks.controller';
import { TwilioService } from '../services/twilio.service';
import { ReceiveInboundMessageCommand } from '../commands/receive-inbound-message.command';
import { ReceiveMailCommand } from '../commands/receive-mail.command';
import { LogCallCommand } from '../commands/log-call.command';

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
}

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    ip: '127.0.0.1',
    protocol: 'https',
    get: jest.fn().mockReturnValue('localhost'),
    originalUrl: '/api/webhooks/twilio/inbound',
    ...overrides,
  } as unknown as import('express').Request;
}

const PHONE = '+33612345678';
const NORMALIZED_PHONE = '+33612345678';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let commandBus: jest.Mocked<CommandBus>;
  let twilioService: jest.Mocked<TwilioService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        { provide: CommandBus, useValue: { execute: jest.fn() } },
        {
          provide: TwilioService,
          useValue: {
            validateSignature: jest.fn(),
            normalizeE164: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(WebhooksController);
    commandBus = module.get(CommandBus) as jest.Mocked<CommandBus>;
    twilioService = module.get(TwilioService) as jest.Mocked<TwilioService>;

    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
    process.env.TWILIO_FORWARD_NUMBER = '+33700000000';
    process.env.TWILIO_WEBHOOK_BASE_URL = 'https://example.ngrok.io';
  });

  afterEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FORWARD_NUMBER;
    delete process.env.TWILIO_WEBHOOK_BASE_URL;
  });

  // ── POST /twilio/inbound ────────────────────────────────────────────────

  describe('POST /webhooks/twilio/inbound — SMS', () => {
    const smsDto = {
      From: PHONE,
      To: '+33700000000',
      Body: 'Hi, I need a quote',
      MessageSid: 'SMabc',
      AccountSid: 'ACxyz',
    };

    it('validates Twilio signature, normalizes phone and dispatches ReceiveInboundMessageCommand', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(true);
      (twilioService.normalizeE164 as jest.Mock).mockReturnValue(NORMALIZED_PHONE);
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      const req = makeReq({ body: smsDto, originalUrl: '/api/webhooks/twilio/inbound' });
      const res = makeRes();

      await controller.handleTwilioInbound(smsDto as never, 'valid-sig', req, res as never);

      expect(twilioService.validateSignature).toHaveBeenCalledWith(
        'test-auth-token',
        'valid-sig',
        expect.any(String),
        smsDto,
      );
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: NORMALIZED_PHONE,
          channel: 'SMS',
          content: 'Hi, I need a quote',
        }),
      );
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(ReceiveInboundMessageCommand),
      );
    });

    it('responds with empty TwiML to prevent Twilio retries', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(true);
      (twilioService.normalizeE164 as jest.Mock).mockReturnValue(NORMALIZED_PHONE);
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      const req = makeReq({ body: smsDto });
      const res = makeRes();

      await controller.handleTwilioInbound(smsDto as never, 'valid-sig', req, res as never);

      expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/xml');
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('<Response>'),
      );
    });

    it('throws BadRequestException when Twilio signature is invalid', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(false);

      const req = makeReq({ body: smsDto });
      const res = makeRes();

      await expect(
        controller.handleTwilioInbound(smsDto as never, 'bad-sig', req, res as never),
      ).rejects.toThrow(BadRequestException);

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when phone cannot be normalized', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(true);
      (twilioService.normalizeE164 as jest.Mock).mockReturnValue(null);

      const badDto = { ...smsDto, From: 'not-a-phone' };
      const req = makeReq({ body: badDto });
      const res = makeRes();

      await expect(
        controller.handleTwilioInbound(badDto as never, 'sig', req, res as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /webhooks/twilio/inbound — WhatsApp', () => {
    const waDto = {
      From: `whatsapp:${PHONE}`,
      To: 'whatsapp:+33700000000',
      Body: 'Bonjour depuis WhatsApp',
      ProfileName: 'Alice',
      MessageSid: 'SMwa123',
      AccountSid: 'ACxyz',
    };

    it('detects WhatsApp prefix and dispatches command with channel WHATSAPP', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(true);
      (twilioService.normalizeE164 as jest.Mock).mockReturnValue(NORMALIZED_PHONE);
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      const req = makeReq({ body: waDto });
      const res = makeRes();

      await controller.handleTwilioInbound(waDto as never, 'sig', req, res as never);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'WHATSAPP', phone: NORMALIZED_PHONE }),
      );
    });

    it('strips whatsapp: prefix so the command receives a bare E.164 phone number', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(true);
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      const req = makeReq({ body: waDto });
      const res = makeRes();

      await controller.handleTwilioInbound(waDto as never, 'sig', req, res as never);

      // The command phone must not contain the whatsapp: prefix
      const dispatched: ReceiveInboundMessageCommand = (commandBus.execute as jest.Mock).mock.calls[0][0];
      expect(dispatched.phone).not.toContain('whatsapp:');
      expect(dispatched.phone).toBe(NORMALIZED_PHONE);
    });
  });

  // ── POST /mail/inbound ──────────────────────────────────────────────────

  describe('POST /webhooks/mail/inbound', () => {
    it('accepts direct format (from, subject, html) and dispatches ReceiveMailCommand', async () => {
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.handleMailInbound({
        from: 'client@example.com',
        subject: 'Need a quote',
        html: '<p>Please quote bathroom renovation.</p>',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(ReceiveMailCommand));
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'client@example.com',
          subject: 'Need a quote',
          content: '<p>Please quote bathroom renovation.</p>',
        }),
      );
      expect(result).toEqual({ received: true });
    });

    it('accepts Cloudmailin JSON Normalized format (envelope.from, headers.subject)', async () => {
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      await controller.handleMailInbound({
        envelope: { from: 'cloudclient@example.com', to: 'inbox@cloudmailin.net' },
        headers: { subject: 'Cloudmailin subject', message_id: '<cm-msg-id@example.com>' },
        plain: 'Plain text body',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'cloudclient@example.com',
          subject: 'Cloudmailin subject',
          content: 'Plain text body',
          messageId: '<cm-msg-id@example.com>',
        }),
      );
    });

    it('passes In-Reply-To and References headers through for email threading', async () => {
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      await controller.handleMailInbound({
        from: 'client@example.com',
        subject: 'Re: Quote request',
        text: 'Got it thanks',
        inReplyTo: '<prior-msg@resend.dev>',
        references: '<prior-msg@resend.dev> <older@resend.dev>',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          inReplyTo: '<prior-msg@resend.dev>',
          references: ['<prior-msg@resend.dev>', '<older@resend.dev>'],
        }),
      );
    });

    it('throws BadRequestException when "from" field is missing', async () => {
      await expect(
        controller.handleMailInbound({ subject: 'Test', html: '<p>Hi</p>' }),
      ).rejects.toThrow(BadRequestException);

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('falls back to "(sans objet)" when no subject is provided', async () => {
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      await controller.handleMailInbound({
        from: 'nosubject@example.com',
        html: '<p>No subject email</p>',
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ subject: '(sans objet)' }),
      );
    });
  });

  // ── POST /twilio/voice ──────────────────────────────────────────────────

  describe('POST /webhooks/twilio/voice', () => {
    it('returns TwiML that dials the configured forward number', () => {
      const res = makeRes();

      controller.handleTwilioVoice(res as never);

      expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/xml');
      const sentTwiml: string = (res.send as jest.Mock).mock.calls[0][0];
      expect(sentTwiml).toContain('<Dial>');
      expect(sentTwiml).toContain('+33700000000');
    });

    it('returns empty TwiML when TWILIO_FORWARD_NUMBER is not configured', () => {
      delete process.env.TWILIO_FORWARD_NUMBER;
      const res = makeRes();

      controller.handleTwilioVoice(res as never);

      const sentTwiml: string = (res.send as jest.Mock).mock.calls[0][0];
      expect(sentTwiml).not.toContain('<Dial>');
      expect(sentTwiml).toContain('<Response>');
    });
  });

  // ── POST /twilio/voice/status ───────────────────────────────────────────

  describe('POST /webhooks/twilio/voice/status', () => {
    const completedInboundDto = {
      CallSid: 'CAabc',
      CallStatus: 'completed',
      CallDuration: '150',
      Direction: 'inbound',
      From: PHONE,
      To: '+33700000000',
    };

    it('validates signature, normalizes phone and dispatches LogCallCommand for a completed inbound call', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(true);
      (twilioService.normalizeE164 as jest.Mock).mockReturnValue(NORMALIZED_PHONE);
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      const req = makeReq({ body: completedInboundDto, originalUrl: '/api/webhooks/twilio/voice/status' });
      const res = makeRes();

      await controller.handleTwilioVoiceStatus(
        completedInboundDto as never,
        'valid-sig',
        req,
        res as never,
      );

      expect(commandBus.execute).toHaveBeenCalledWith(expect.any(LogCallCommand));
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: NORMALIZED_PHONE,
          direction: 'INBOUND',
          status: 'completed',
          duration: 150,
        }),
      );
    });

    it('maps "no-answer" CallStatus to status "no-answer"', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(true);
      (twilioService.normalizeE164 as jest.Mock).mockReturnValue(NORMALIZED_PHONE);
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      const dto = { ...completedInboundDto, CallStatus: 'no-answer', CallDuration: '0' };
      const req = makeReq({ body: dto });
      const res = makeRes();

      await controller.handleTwilioVoiceStatus(dto as never, 'sig', req, res as never);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'no-answer', duration: 0 }),
      );
    });

    it('maps outbound-api Direction to OUTBOUND and uses "To" as the contact phone', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(true);
      (twilioService.normalizeE164 as jest.Mock).mockReturnValue(NORMALIZED_PHONE);
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      const dto = {
        CallSid: 'CAout',
        CallStatus: 'completed',
        CallDuration: '60',
        Direction: 'outbound-api',
        From: '+33700000000',
        To: PHONE,
      };
      const req = makeReq({ body: dto });
      const res = makeRes();

      await controller.handleTwilioVoiceStatus(dto as never, 'sig', req, res as never);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'OUTBOUND', phone: NORMALIZED_PHONE }),
      );
    });

    it('throws UnauthorizedException when Twilio signature is invalid', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(false);

      const req = makeReq({ body: completedInboundDto });
      const res = makeRes();

      await expect(
        controller.handleTwilioVoiceStatus(
          completedInboundDto as never,
          'bad-sig',
          req,
          res as never,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('maps "completed" with duration 0 as "no-answer" (zero-duration completed call)', async () => {
      (twilioService.validateSignature as jest.Mock).mockReturnValue(true);
      (twilioService.normalizeE164 as jest.Mock).mockReturnValue(NORMALIZED_PHONE);
      (commandBus.execute as jest.Mock).mockResolvedValue(undefined);

      const dto = { ...completedInboundDto, CallStatus: 'completed', CallDuration: '0' };
      const req = makeReq({ body: dto });
      const res = makeRes();

      await controller.handleTwilioVoiceStatus(dto as never, 'sig', req, res as never);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'no-answer' }),
      );
    });
  });
});
