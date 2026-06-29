import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import axios from 'axios';
import {
  isAcceptedAttachmentType,
  extFromFilename,
} from '../utils/attachment.utils';
import { StorageService } from './storage.service';

export interface SendEmailOptions {
  /** Override the default sender mailbox */
  from?: string;
  /** File attachments to include in the email */
  attachments?: Express.Multer.File[];
}

interface CachedToken {
  value: string;
  /** epoch ms */
  expiresAt: number;
}

export interface GraphMessage {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  body: { contentType: string; content: string };
  internetMessageId: string;
  internetMessageHeaders: Array<{ name: string; value: string }>;
}

export interface GraphSubscriptionInfo {
  id: string;
  mailbox: string;
  expirationDateTime: string;
}

@Injectable()
export class MsGraphMailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MsGraphMailService.name);

  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  /** Default sender address (TEST_MAIL or MS_GRAPH_DEFAULT_FROM) */
  readonly defaultFrom: string;

  private cachedToken: CachedToken | null = null;
  private readonly activeSubscriptions: GraphSubscriptionInfo[] = [];
  private renewalTimer: NodeJS.Timeout | null = null;

  constructor(private readonly storage: StorageService) {
    const tenantId = process.env.ENTRA_TENANT_ID;
    const clientId = process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.ENTRA_CLIENT_SECRET;
    const defaultFrom =
      process.env.TEST_MAIL ?? process.env.MS_GRAPH_DEFAULT_FROM;

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error(
        'ENTRA_TENANT_ID, ENTRA_CLIENT_ID and ENTRA_CLIENT_SECRET must be defined',
      );
    }
    if (!defaultFrom) {
      throw new Error('TEST_MAIL or MS_GRAPH_DEFAULT_FROM must be defined');
    }

    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.defaultFrom = defaultFrom;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  onModuleInit(): void {
    // Renew all subscriptions every 2 days (max subscription lifetime ≈ 3 days)
    this.renewalTimer = setInterval(
      () => {
        void this.renewAllSubscriptions();
      },
      2 * 24 * 60 * 60 * 1000,
    );
  }

  /**
   * Must be called AFTER the HTTP server is listening (i.e. after app.listen()
   * in main.ts) so that Graph can reach the validation endpoint.
   */
  async registerSubscriptions(): Promise<void> {
    const publicUrl = process.env.APP_PUBLIC_URL;
    if (!publicUrl) {
      this.logger.warn(
        'APP_PUBLIC_URL not set — skipping Graph subscription creation',
      );
      return;
    }

    const notificationUrl = `${publicUrl}/api/webhooks/ms-graph/mail`;
    try {
      await this.subscribeMailboxIfNotExists(this.defaultFrom, notificationUrl);
    } catch (err) {
      const detail = this.extractGraphError(err);
      this.logger.error(
        `Failed to register Graph subscription for ${this.defaultFrom}: ${detail}`,
      );
    }
  }

  /**
   * Reuses an existing active subscription for the mailbox+notificationUrl pair
   * if one exists, otherwise creates a new one. Avoids duplicate subscriptions
   * when the server restarts repeatedly.
   */
  private async subscribeMailboxIfNotExists(
    mailbox: string,
    notificationUrl: string,
  ): Promise<void> {
    const token = await this.getAccessToken();
    const response = await axios.get<{
      value: Array<{
        id: string;
        resource: string;
        notificationUrl: string;
        expirationDateTime: string;
      }>;
    }>('https://graph.microsoft.com/v1.0/subscriptions', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const expectedResource = `users/${mailbox}/mailFolders/inbox/messages`;
    const now = new Date();

    const existing = response.data.value.find(
      (s) =>
        s.resource.toLowerCase() === expectedResource.toLowerCase() &&
        s.notificationUrl === notificationUrl &&
        new Date(s.expirationDateTime) > now,
    );

    if (existing) {
      this.logger.log(
        `Reusing existing Graph subscription — mailbox=${mailbox} id=${existing.id} expires=${existing.expirationDateTime}`,
      );
      this.activeSubscriptions.push({
        id: existing.id,
        mailbox,
        expirationDateTime: existing.expirationDateTime,
      });
      return;
    }

    await this.subscribeMailbox(mailbox, notificationUrl);
  }

  onModuleDestroy(): void {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
    }
  }

  // ── Token management ─────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.value;
    }

    const url = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });

    const response = await axios.post<{
      access_token: string;
      expires_in: number;
    }>(url, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    this.cachedToken = {
      value: response.data.access_token,
      expiresAt: now + response.data.expires_in * 1000,
    };

    return this.cachedToken.value;
  }

  // ── Send email ───────────────────────────────────────────────────────────

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: SendEmailOptions,
  ): Promise<string> {
    const from = options?.from ?? this.defaultFrom;
    const token = await this.getAccessToken();

    const graphAttachments = (options?.attachments ?? []).map((f) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: f.originalname,
      contentType: f.mimetype,
      contentBytes: f.buffer.toString('base64'),
    }));

    const message: Record<string, unknown> = {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: to } }],
    };
    if (graphAttachments.length > 0) {
      message.attachments = graphAttachments;
    }

    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`;

    try {
      await axios.post(
        url,
        { message },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (err: unknown) {
      const msg = this.extractGraphError(err);
      this.logger.error(`Graph sendMail failed: ${msg}`);
      throw new InternalServerErrorException(
        `Failed to send email via Graph API: ${msg}`,
      );
    }

    // Graph assigns its own Message-Id; generate a local ID for meta tracking
    const localId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@poc-inbox>`;
    this.logger.log(`Email sent via Graph API — to=${to} from=${from}`);
    return localId;
  }

  /**
   * Reply to an existing message using Graph's createReply endpoint.
   * Preserves RFC threading headers (In-Reply-To, References) natively.
   * Requires Mail.ReadWrite application permission.
   */
  async replyToMessage(
    from: string,
    graphMessageId: string,
    html: string,
    attachments?: Express.Multer.File[],
  ): Promise<string> {
    const token = await this.getAccessToken();
    const baseUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/messages/${graphMessageId}`;

    try {
      // 1. Create a reply draft (Graph sets In-Reply-To and References automatically)
      const draftRes = await axios.post<{
        id: string;
        internetMessageId: string;
      }>(
        `${baseUrl}/createReply`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const draftId = draftRes.data.id;
      const internetMessageId = draftRes.data.internetMessageId;

      // 2. Set our HTML body on the draft
      await axios.patch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/messages/${draftId}`,
        { body: { contentType: 'HTML', content: html } },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // 3. Add attachments to the draft if provided
      if (attachments && attachments.length > 0) {
        for (const file of attachments) {
          await axios.post(
            `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/messages/${draftId}/attachments`,
            {
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: file.originalname,
              contentType: file.mimetype,
              contentBytes: file.buffer.toString('base64'),
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          );
        }
      }

      // 4. Send the draft
      await axios.post(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/messages/${draftId}/send`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      this.logger.log(
        `Reply sent via Graph API — from=${from} draftId=${draftId}`,
      );
      return internetMessageId;
    } catch (err: unknown) {
      const msg = this.extractGraphError(err);
      this.logger.error(`Graph replyToMessage failed: ${msg}`);
      throw new InternalServerErrorException(
        `Failed to send reply via Graph API: ${msg}`,
      );
    }
  }

  /**
   * Fetch attachment list for a message and return public-facing download paths.
   * Only real file attachments that are images or PDFs are fetched; inline
   * attachments (e.g. signature logos embedded in the HTML body) are skipped.
   */
  async getMessageAttachmentUrls(
    mailbox: string,
    graphMessageId: string,
  ): Promise<string[]> {
    const token = await this.getAccessToken();
    // No $select: `contentBytes` only exists on the derived type
    // microsoft.graph.fileAttachment, not the base microsoft.graph.attachment
    // the collection is typed as — selecting it makes Graph reject the request.
    // The unselected GET returns full attachment objects (contentBytes + isInline).
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${graphMessageId}/attachments`;

    try {
      const res = await axios.get<{
        value: Array<{
          id: string;
          name: string;
          contentType: string;
          contentBytes?: string;
          size: number;
          isInline?: boolean;
        }>;
      }>(url, { headers: { Authorization: `Bearer ${token}` } });

      const urls: string[] = [];

      for (const att of res.data.value) {
        if (att.isInline) continue;
        if (!isAcceptedAttachmentType(att.contentType)) continue;
        if (!att.contentBytes) continue;

        const url = await this.storage.upload(
          Buffer.from(att.contentBytes, 'base64'),
          att.contentType,
          extFromFilename(att.name),
        );
        urls.push(url);
      }

      return urls;
    } catch (err: unknown) {
      const msg = this.extractGraphError(err);
      this.logger.warn(
        `Could not fetch attachments for ${graphMessageId}: ${msg}`,
      );
      return [];
    }
  }
  // ── Fetch message content ─────────────────────────────────────────────────

  async getMessage(mailbox: string, messageId: string): Promise<GraphMessage> {
    const token = await this.getAccessToken();
    const select =
      'id,subject,from,body,internetMessageId,internetMessageHeaders';
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${messageId}?$select=${select}`;

    try {
      const response = await axios.get<GraphMessage>(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (err: unknown) {
      const msg = this.extractGraphError(err);
      this.logger.error(`Graph getMessage failed: ${msg}`);
      throw new InternalServerErrorException(
        `Failed to fetch message from Graph API: ${msg}`,
      );
    }
  }

  // ── Subscription management ───────────────────────────────────────────────

  async subscribeMailbox(
    mailbox: string,
    notificationUrl: string,
  ): Promise<GraphSubscriptionInfo> {
    const token = await this.getAccessToken();
    // Max subscription lifetime: 4230 minutes (~3 days)
    const expirationDateTime = new Date(
      Date.now() + 4230 * 60 * 1000,
    ).toISOString();

    const body = {
      changeType: 'created',
      notificationUrl,
      resource: `users/${mailbox}/mailFolders/inbox/messages`,
      expirationDateTime,
      clientState: process.env.MS_GRAPH_WEBHOOK_SECRET ?? 'poc-inbox-secret',
    };

    const response = await axios.post<{
      id: string;
      expirationDateTime: string;
    }>('https://graph.microsoft.com/v1.0/subscriptions', body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const sub: GraphSubscriptionInfo = {
      id: response.data.id,
      mailbox,
      expirationDateTime: response.data.expirationDateTime,
    };

    this.activeSubscriptions.push(sub);
    this.logger.log(
      `Graph subscription created — mailbox=${mailbox} id=${sub.id} expires=${sub.expirationDateTime}`,
    );
    return sub;
  }

  async renewAllSubscriptions(): Promise<void> {
    for (const sub of this.activeSubscriptions) {
      try {
        await this.renewSubscription(sub);
      } catch (err) {
        this.logger.error(
          `Failed to renew subscription ${sub.id}: ${String(err)}`,
        );
      }
    }
  }

  private async renewSubscription(sub: GraphSubscriptionInfo): Promise<void> {
    const token = await this.getAccessToken();
    const expirationDateTime = new Date(
      Date.now() + 4230 * 60 * 1000,
    ).toISOString();

    await axios.patch(
      `https://graph.microsoft.com/v1.0/subscriptions/${sub.id}`,
      { expirationDateTime },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    sub.expirationDateTime = expirationDateTime;
    this.logger.log(
      `Subscription ${sub.id} renewed until ${expirationDateTime}`,
    );
  }

  getActiveSubscriptions(): GraphSubscriptionInfo[] {
    return [...this.activeSubscriptions];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private extractGraphError(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data as Record<string, unknown> | undefined;
      if (data?.error && typeof data.error === 'object') {
        const e = data.error as { code?: string; message?: string };
        return `${e.code ?? 'unknown'}: ${e.message ?? 'no message'}`;
      }
      return err.message;
    }
    return err instanceof Error ? err.message : String(err);
  }
}
