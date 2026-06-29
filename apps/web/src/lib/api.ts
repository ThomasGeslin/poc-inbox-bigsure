import type { Contact, Conversation, Message } from "../types";
import { getAvatarColor } from "../utils/helpers";

export const BASE_URL = "http://localhost:3000/api";

export interface ConversationWithContact extends Conversation {
  contact: Contact;
}

export type RawConversation = Omit<ConversationWithContact, "contact"> & {
  contact: Omit<Contact, "avatarColor">;
};

/** Derive the UI shape of a conversation (adds the contact's avatar color). */
export function toConversationWithContact(
  conv: RawConversation,
): ConversationWithContact {
  return {
    ...conv,
    contact: { ...conv.contact, avatarColor: getAvatarColor(conv.contact.id) },
  };
}

/** Fetch all conversations with their associated contact information */
export async function fetchConversations(): Promise<ConversationWithContact[]> {
  const res = await fetch(`${BASE_URL}/conversations`);

  if (!res.ok) throw new Error("Failed to fetch conversations");

  const data: RawConversation[] = await res.json();

  return data.map(toConversationWithContact);
}

/** Fetch all messages for a given conversation */
export async function fetchMessages(
  conversationId: string,
): Promise<Message[]> {
  const res = await fetch(
    `${BASE_URL}/conversations/${conversationId}/messages`,
  );

  if (!res.ok) throw new Error("Failed to fetch messages");

  return res.json();
}

export interface SendMessagePayload {
  channel: string;
  content: string;
  subject?: string;
  attachments?: File[];
}

/** Send an outbound message on a conversation */
export async function sendMessage(
  conversationId: string,
  payload: SendMessagePayload,
): Promise<Message> {
  let res: globalThis.Response;

  if (payload.attachments && payload.attachments.length > 0) {
    const form = new FormData();
    form.append("channel", payload.channel);
    form.append("content", payload.content);
    if (payload.subject) form.append("subject", payload.subject);
    for (const file of payload.attachments) {
      form.append("attachments", file);
    }
    res = await fetch(
      `${BASE_URL}/conversations/${conversationId}/messages`,
      { method: "POST", body: form },
    );
  } else {
    res = await fetch(
      `${BASE_URL}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: payload.channel,
          content: payload.content,
          subject: payload.subject,
        }),
      },
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const apiMessage =
      body && typeof body.message === "string" ? body.message : null;
    throw new Error(apiMessage ?? "Failed to send message");
  }

  return res.json();
}

export interface CreateContactPayload {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  company?: string;
}

/** Create a new contact */
export async function createContact(
  payload: CreateContactPayload,
): Promise<Omit<Contact, "avatarColor">> {
  const res = await fetch(`${BASE_URL}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const apiMessage =
      body && typeof body.message === "string" ? body.message : null;
    throw new Error(apiMessage ?? "Failed to create contact");
  }

  return res.json();
}

export interface UpdateContactPayload {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  company?: string;
}

/** Update a contact's information */
export async function updateContact(
  contactId: string,
  payload: UpdateContactPayload,
): Promise<Omit<Contact, "avatarColor">> {
  const res = await fetch(`${BASE_URL}/contacts/${contactId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const apiMessage =
      body && typeof body.message === "string" ? body.message : null;
    throw new Error(apiMessage ?? "Failed to update contact");
  }

  return res.json();
}

/** Mark a conversation as read (reset unread count to 0) */
export async function markConversationAsRead(
  conversationId: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}/read`, {
    method: "PATCH",
  });

  if (!res.ok) throw new Error("Failed to mark conversation as read");
}
