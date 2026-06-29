import { Channel, ConversationStatus, Message, Prisma } from '@prisma/client';

/**
 * Shared serialization layer between the REST query handlers and the realtime
 * (SSE) stream. Keeping a single source of truth guarantees that an event
 * payload has the exact same shape as the equivalent REST response, so the
 * frontend can apply both interchangeably.
 */

export const CHANNEL_MAP: Record<Channel, string> = {
  MAIL: 'mail',
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  CALL: 'call',
};

export const STATUS_MAP: Record<ConversationStatus, string> = {
  A_TRAITER: 'to_attach',
  A_PLANIFIER: 'to_plan',
  DEVIS_APRES_VISITE: 'quote_after_meeting',
  EN_ATTENTE: 'waiting',
  TRAITE: 'treated',
};

/**
 * The `include` used everywhere a conversation needs to be serialized.
 * Messages are pulled newest-first so `messages[0]` is the last message.
 */
export const CONVERSATION_INCLUDE = {
  contact: true,
  messages: {
    orderBy: { timestamp: 'desc' },
    select: { content: true, channel: true },
  },
} satisfies Prisma.ConversationInclude;

export type ConversationForSerialization = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_INCLUDE;
}>;

export interface SerializedMessage {
  id: string;
  conversationId: string;
  channel: string;
  direction: string;
  content: string;
  timestamp: string;
  meta?: unknown;
}

export interface SerializedContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  company: string | null;
}

export interface SerializedConversation {
  id: string;
  contactId: string;
  subject: string | null;
  status: string;
  channel: string;
  channels: string[];
  unreadCount: number;
  lastMessageAt: string;
  lastMessage: string;
  contact: SerializedContact;
}

export function serializeMessage(msg: Message): SerializedMessage {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    channel: CHANNEL_MAP[msg.channel],
    direction: msg.direction.toLowerCase(),
    content: msg.content,
    timestamp: msg.timestamp.toISOString(),
    meta: msg.meta ?? undefined,
  };
}

export function serializeConversation(
  conv: ConversationForSerialization,
): SerializedConversation {
  // Distinct channels used across all messages in this conversation
  const distinctChannels = [...new Set(conv.messages.map((m) => m.channel))];

  return {
    id: conv.id,
    contactId: conv.contactId,
    subject: conv.subject,
    status: STATUS_MAP[conv.status],
    // channel = last channel used (first message after desc sort), else the
    // conversation's own channel column.
    channel: CHANNEL_MAP[conv.messages[0]?.channel ?? conv.channel],
    channels: distinctChannels.map((ch) => CHANNEL_MAP[ch]),
    unreadCount: conv.unreadCount,
    lastMessageAt: conv.lastMessageAt.toISOString(),
    lastMessage: conv.messages[0]?.content ?? '',
    contact: {
      id: conv.contact.id,
      name: conv.contact.name,
      email: conv.contact.email,
      phone: conv.contact.phone,
      role: conv.contact.role,
      company: conv.contact.company,
    },
  };
}
