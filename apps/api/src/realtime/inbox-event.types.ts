import type {
  SerializedConversation,
  SerializedMessage,
} from '../inbox/serializers/inbox.serializer';

/**
 * Typed envelope pushed over the SSE stream. The frontend switches on `type`
 * and applies `payload` to its local state.
 */
export type InboxEvent =
  | { type: 'message.created'; payload: SerializedMessage }
  | { type: 'conversation.updated'; payload: SerializedConversation };
