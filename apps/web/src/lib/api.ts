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
