import type { Contact, Conversation, Message } from "../types";
import { getAvatarColor } from "../utils/helpers";
import { getAccessPassword, notifyUnauthorized } from "./auth";

// `||` rather than `??` on purpose: an env var left empty in a hosting
// dashboard arrives as "", which must fall back rather than produce relative
// URLs pointing at the frontend itself.
export const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export const ACCESS_PASSWORD_HEADER = "x-poc-password";

export interface ConversationWithContact extends Conversation {
  contact: Contact;
}

export type RawConversation = Omit<ConversationWithContact, "contact"> & {
  contact: Omit<Contact, "avatarColor">;
};

/**
 * Single entry point for every API call: attaches the shared password and turns
 * a 401 into a re-prompt. Going through here is what keeps the header from
 * being forgotten on a new endpoint.
 */
async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<globalThis.Response> {
  const password = getAccessPassword();
  const headers = new Headers(init.headers);

  if (password) headers.set(ACCESS_PASSWORD_HEADER, password);

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    notifyUnauthorized();
    throw new Error("Accès refusé : mot de passe requis");
  }

  return res;
}

/** Extract the API's error message when it provides one. */
async function apiError(
  res: globalThis.Response,
  fallback: string,
): Promise<Error> {
  const body: unknown = await res.json().catch(() => null);
  const message =
    body !== null &&
    typeof body === "object" &&
    "message" in body &&
    typeof (body as { message: unknown }).message === "string"
      ? (body as { message: string }).message
      : null;

  return new Error(message ?? fallback);
}

/**
 * Verify a candidate password against the API. Deliberately bypasses
 * `apiFetch`: a wrong password here is an expected answer, not a session loss.
 */
export async function checkPassword(password: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/auth/check`, {
    headers: { [ACCESS_PASSWORD_HEADER]: password },
  });

  return res.ok;
}

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
  const res = await apiFetch("/conversations");

  if (!res.ok) throw new Error("Failed to fetch conversations");

  const data: RawConversation[] = await res.json();

  return data.map(toConversationWithContact);
}

/** Fetch all messages for a given conversation */
export async function fetchMessages(
  conversationId: string,
): Promise<Message[]> {
  const res = await apiFetch(`/conversations/${conversationId}/messages`);

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
    res = await apiFetch(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: form,
    });
  } else {
    res = await apiFetch(`/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: payload.channel,
        content: payload.content,
        subject: payload.subject,
      }),
    });
  }

  if (!res.ok) throw await apiError(res, "Failed to send message");

  return res.json();
}

/** Fetch all contacts (used to pick a recipient when starting a conversation) */
export async function fetchContacts(): Promise<Contact[]> {
  const res = await apiFetch("/contacts");

  if (!res.ok) throw new Error("Failed to fetch contacts");

  const data: Omit<Contact, "avatarColor">[] = await res.json();

  return data.map((contact) => ({
    ...contact,
    avatarColor: getAvatarColor(contact.id),
  }));
}

export interface StartConversationPayload {
  contactId: string;
  channel: string;
  content: string;
  subject?: string;
  attachments?: File[];
}

/** Start a new conversation with an existing contact and send the first message */
export async function startConversation(
  payload: StartConversationPayload,
): Promise<ConversationWithContact> {
  let res: globalThis.Response;

  if (payload.attachments && payload.attachments.length > 0) {
    const form = new FormData();

    form.append("contactId", payload.contactId);
    form.append("channel", payload.channel);
    form.append("content", payload.content);

    if (payload.subject) form.append("subject", payload.subject);

    for (const file of payload.attachments) {
      form.append("attachments", file);
    }

    res = await apiFetch("/conversations", { method: "POST", body: form });
  } else {
    res = await apiFetch("/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: payload.contactId,
        channel: payload.channel,
        content: payload.content,
        subject: payload.subject,
      }),
    });
  }

  if (!res.ok) throw await apiError(res, "Failed to start conversation");

  return toConversationWithContact(await res.json());
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
  const res = await apiFetch("/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw await apiError(res, "Failed to create contact");

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
  const res = await apiFetch(`/contacts/${contactId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw await apiError(res, "Failed to update contact");

  return res.json();
}

/** Mark a conversation as read (reset unread count to 0) */
export async function markConversationAsRead(
  conversationId: string,
): Promise<void> {
  const res = await apiFetch(`/conversations/${conversationId}/read`, {
    method: "PATCH",
  });

  if (!res.ok) throw new Error("Failed to mark conversation as read");
}
