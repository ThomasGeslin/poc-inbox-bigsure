import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable, Subject, map } from 'rxjs';
import { Message } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CONVERSATION_INCLUDE,
  serializeConversation,
  serializeMessage,
} from '../inbox/serializers/inbox.serializer';
import { InboxEvent } from './inbox-event.types';

/**
 * In-memory pub/sub for inbox realtime events, exposed to clients as an SSE
 * stream. Command handlers call the `emit*` methods after a successful write;
 * connected `EventSource` clients receive the serialized payload immediately,
 * replacing the previous 5s frontend polling.
 *
 * NOTE: the Subject is process-local — events only reach clients connected to
 * this instance. For a multi-instance deployment, back it with a shared bus
 * (Postgres LISTEN/NOTIFY or Redis pub/sub): each instance listens and re-emits
 * into its local Subject.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly events$ = new Subject<InboxEvent>();

  constructor(private readonly prisma: PrismaService) {}

  /** SSE stream consumed by the controller's `@Sse()` endpoint. */
  stream(): Observable<MessageEvent> {
    return this.events$.pipe(map((event) => ({ data: event })));
  }

  /** Broadcast a newly created message (inbound or outbound). */
  emitMessageCreated(message: Message): void {
    this.events$.next({
      type: 'message.created',
      payload: serializeMessage(message),
    });
  }

  /**
   * Reload a conversation in the standard list shape and broadcast it, so
   * connected clients refresh `lastMessage`, `unreadCount`, `status`, etc.
   * Failures are swallowed: a missed realtime push must never break the write
   * that triggered it.
   */
  async emitConversationUpdated(conversationId: string): Promise<void> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: CONVERSATION_INCLUDE,
      });

      if (!conversation) return;

      this.events$.next({
        type: 'conversation.updated',
        payload: serializeConversation(conversation),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to emit conversation.updated for ${conversationId}: ${msg}`,
      );
    }
  }
}
