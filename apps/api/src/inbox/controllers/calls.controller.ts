import {
  Body,
  Controller,
  Logger,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TwilioService } from '../services/twilio.service';

@Controller('calls')
export class CallsController {
  private readonly logger = new Logger(CallsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioService: TwilioService,
  ) {}

  /**
   * POST /api/calls/initiate
   * Body: { contactId: string }
   *
   * Initiates an outbound call to the contact's phone number.
   * Twilio will hit /api/webhooks/twilio/voice for TwiML and
   * /api/webhooks/twilio/voice/status when the call ends (which
   * persists the call log in the conversation thread).
   */
  @Post('initiate')
  async initiateCall(
    @Body() body: { contactId: string },
  ): Promise<{ callSid: string }> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: body.contactId },
    });

    if (!contact || !contact.phone) {
      throw new NotFoundException('Contact not found or has no phone number');
    }

    this.logger.log(
      `Initiating call to contact=${contact.id} phone=${contact.phone}`,
    );

    const callSid = await this.twilioService.initiateCall(contact.phone);

    return { callSid };
  }
}
