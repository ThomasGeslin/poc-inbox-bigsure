import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailOptions {
  inReplyTo?: string;
  references?: string[];
}

@Injectable()
export class ResendService {
  private readonly client: Resend;
  private readonly logger = new Logger(ResendService.name);

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY must be defined');
    }
    this.client = new Resend(apiKey);
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: SendEmailOptions,
  ): Promise<string> {
    const from = process.env.RESEND_FROM_EMAIL;
    if (!from) {
      throw new InternalServerErrorException(
        'RESEND_FROM_EMAIL is not defined',
      );
    }

    const headers: Record<string, string> = {};
    if (options?.inReplyTo) {
      headers['In-Reply-To'] = options.inReplyTo;
    }

    if (options?.references?.length) {
      headers['References'] = options.references.join(' ');
    }

    const { data, error } = await this.client.emails.send({
      from,
      to: [to],
      subject,
      html,
      // Reply-To points to Cloudmailin so contact replies come back into the app
      ...(process.env.CLOUDMAILIN_ADDRESS
        ? { replyTo: process.env.CLOUDMAILIN_ADDRESS }
        : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });

    if (error || !data) {
      const msg = error?.message ?? 'Unknown Resend error';
      this.logger.error(`Resend send failed: ${msg}`);
      throw new InternalServerErrorException(
        `Failed to send email via Resend: ${msg}`,
      );
    }

    return data.id;
  }
}
