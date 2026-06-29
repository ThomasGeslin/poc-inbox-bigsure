export type Channel = "mail" | "whatsapp" | "sms" | "call";

export type ConversationStatus =
  | "to_attach"
  | "to_plan"
  | "quote_after_meeting"
  | "waiting"
  | "treated";

export type CallStatus = "missed" | "answered" | "outbound";

export type CallLogStatus =
  | "completed"
  | "no-answer"
  | "busy"
  | "failed"
  | "voicemail";

export type FilterChannel = "all" | Channel;

export type FilterStatus = "pending" | "treated";

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  company: string;
  avatarColor: string;
}

export interface Conversation {
  id: string;
  contactId: string;
  subject: string;
  status: ConversationStatus;
  channel: Channel; // last channel used
  channels: Channel[]; // all distinct channels in this conversation
  unreadCount: number;
  lastMessageAt: string;
  lastMessage: string;
}

export interface MessageMeta {
  // ── Call-specific (channel === 'call') ─────────────────────────────────
  callSid?: string;
  status?: CallLogStatus;
  duration?: number; // seconds
  from?: string; // E.164
  to?: string; // E.164
  recordingUrl?: string;
  // ── Mail-specific ─────────────────────────────────────────────────────
  subject?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  // ── Twilio SMS / WhatsApp ─────────────────────────────────────────────
  twilioSid?: string;
  accountSid?: string;
  numMedia?: string;
  rawFrom?: string;
  rawTo?: string;
  // ── Attachments (all channels) ────────────────────────────────────────
  mediaUrls?: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  content: string;
  timestamp: string; // ISO 8601
  meta?: MessageMeta;
}
