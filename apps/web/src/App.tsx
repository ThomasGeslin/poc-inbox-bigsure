import { useState, useEffect, useRef } from "react";
import { Inbox, Loader2 } from "lucide-react";
import {
  fetchConversations,
  fetchMessages,
  markConversationAsRead,
  toConversationWithContact,
  type ConversationWithContact,
} from "./lib/api";
import { subscribeToInbox } from "./lib/realtime";
import ConversationList from "./components/ConversationList";
import MessageThread from "./components/MessageThread";
import ContactPanel from "./components/ContactPanel";
import type { Contact, Message, FilterChannel, FilterStatus } from "./types";

function App() {
  const [conversations, setConversations] = useState<ConversationWithContact[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState<FilterChannel>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);

  // Ref mirror of activeId so the (mount-once) realtime subscription can read
  // the current selection without re-subscribing on every change.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  /** Fetch conversations on mount */
  useEffect(() => {
    fetchConversations()
      .then((data) => {
        setConversations(data);
        if (data.length > 0) setActiveId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  /** Fetch messages when the active conversation changes */
  useEffect(() => {
    if (!activeId) return;
    fetchMessages(activeId).then(setActiveMessages);
  }, [activeId]);

  /** Realtime updates via SSE — replaces the previous 5s polling. */
  useEffect(() => {
    const unsubscribe = subscribeToInbox({
      onMessage(message) {
        // Only append to the thread currently open; dedupe by id so an
        // optimistically-added outbound message doesn't double.
        if (message.conversationId !== activeIdRef.current) return;

        setActiveMessages((prev) =>
          prev.some((mess) => mess.id === message.id)
            ? prev
            : [...prev, message],
        );
      },
      onConversation(raw) {
        const updated = toConversationWithContact(raw);
        setConversations((prev) => {
          const others = prev.filter((conv) => conv.id !== updated.id);

          // Re-sort by recency (newest first), matching the backend ordering.
          return [...others, updated].sort((a, b) =>
            a.lastMessageAt < b.lastMessageAt ? 1 : -1,
          );
        });
      },
    });

    return unsubscribe;
  }, []);

  /** Handle conversation selection */
  function handleSelect(id: string) {
    // Already open: bail out. Otherwise we'd clear the thread but the
    // [activeId] effect wouldn't re-fetch (same value = no re-run).
    if (id === activeId) return;

    setActiveMessages([]);
    setActiveId(id);

    // Mark as read optimistically, then persist to backend
    setConversations((prev) =>
      prev.map((conv) => (conv.id === id ? { ...conv, unreadCount: 0 } : conv)),
    );

    markConversationAsRead(id).catch(() => {
      // Revert on failure by re-fetching
      fetchConversations().then(setConversations);
    });
  }

  /** Handle contact created */
  function handleContactCreated() {
    // Refresh conversation list so the new contact appears if they get a conversation
    fetchConversations().then(setConversations);
  }

  /** Handle contact updated */
  function handleContactUpdated(updated: Contact) {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.contact.id === updated.id ? { ...conv, contact: updated } : conv,
      ),
    );
  }

  /** Handle message sent */
  function handleSent(message: Message) {
    // Dedupe by id: the realtime SSE event for this same outbound message may
    // already have arrived (it's pushed before the POST response returns).
    setActiveMessages((prev) =>
      prev.some((m) => m.id === message.id) ? prev : [...prev, message],
    );
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === message.conversationId
          ? {
              ...conv,
              lastMessageAt: message.timestamp,
              lastMessage: message.content,
              unreadCount: 0,
              channels: conv.channels
                ? conv.channels.includes(message.channel)
                  ? conv.channels
                  : [...conv.channels, message.channel]
                : [message.channel],
            }
          : conv,
      ),
    );
  }

  const contacts: Contact[] = conversations.map((c) => c.contact);

  const filtered = conversations.filter((conv) => {
    if (
      filterChannel !== "all" &&
      !(conv.channels ?? [conv.channel]).includes(filterChannel)
    )
      return false;
    if (filterStatus === "treated" && conv.status !== "treated") return false;
    if (filterStatus === "pending" && conv.status === "treated") return false;
    return true;
  });

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const activeContact = activeConv?.contact ?? null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden antialiased">
      <ConversationList
        conversations={filtered}
        allConversations={conversations}
        contacts={contacts}
        activeConversationId={activeId}
        onSelect={handleSelect}
        filterChannel={filterChannel}
        onFilterChannel={setFilterChannel}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        onContactCreated={handleContactCreated}
      />

      {activeConv && activeContact ? (
        <>
          <MessageThread
            conversation={activeConv}
            messages={activeMessages}
            contact={activeContact}
            onSent={handleSent}
          />

          <ContactPanel
            contact={activeContact}
            conversation={activeConv}
            onContactUpdated={handleContactUpdated}
          />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
          <Inbox size={44} className="text-gray-300" />
          <p className="text-sm">Sélectionnez une conversation</p>
        </div>
      )}
    </div>
  );
}

export default App;
