import type { Contact, Conversation, Message } from "../types";
import { getAvatarColor } from "../utils/helpers";

const BASE_URL = "http://localhost:3000/api";

export interface ConversationWithContact extends Conversation {
  contact: Contact;
}

type RawConversation = Omit<ConversationWithContact, "contact"> & {
  contact: Omit<Contact, "avatarColor">;
};

/** Fetch all conversations with their associated contact information */
export async function fetchConversations(): Promise<ConversationWithContact[]> {
  const res = await fetch(`${BASE_URL}/conversations`);

  if (!res.ok) throw new Error("Failed to fetch conversations");

  const data: RawConversation[] = await res.json();

  return data.map((conv) => ({
    ...conv,
    contact: { ...conv.contact, avatarColor: getAvatarColor(conv.contact.id) },
  }));
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
}

/** Send an outbound message on a conversation */
export async function sendMessage(
  conversationId: string,
  payload: SendMessagePayload,
): Promise<Message> {
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to send message");

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

  if (!res.ok) throw new Error("Failed to update contact");

  return res.json();
}
