import { BASE_URL, type RawConversation } from "./api";
import type { Message } from "../types";

/**
 * Inbox realtime events, mirrored from the backend SSE stream
 * (apps/api/src/realtime/inbox-event.types.ts). Payloads have the exact same
 * shape as the REST responses, so they can be applied to state directly.
 */
type InboxEvent =
  | { type: "message.created"; payload: Message }
  | { type: "conversation.updated"; payload: RawConversation };

export interface InboxSubscriptionHandlers {
  onMessage: (message: Message) => void;
  onConversation: (conversation: RawConversation) => void;
}

/**
 * Subscribe to the inbox realtime stream. Replaces the previous 5s polling.
 * The native `EventSource` reconnects automatically on connection drop.
 *
 * @returns a cleanup function that closes the connection.
 */
export function subscribeToInbox(
  handlers: InboxSubscriptionHandlers,
): () => void {
  const source = new EventSource(`${BASE_URL}/realtime/stream`);

  source.onmessage = (e: MessageEvent<string>) => {
    let event: InboxEvent;
    try {
      event = JSON.parse(e.data) as InboxEvent;
    } catch {
      return; // ignore malformed frames (e.g. keep-alive comments)
    }

    switch (event.type) {
      case "message.created":
        handlers.onMessage(event.payload);
        break;
      case "conversation.updated":
        handlers.onConversation(event.payload);
        break;
    }
  };

  return () => source.close();
}
