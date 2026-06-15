import { useState, useEffect } from "react";
import { Inbox, Loader2 } from "lucide-react";
import {
  fetchConversations,
  fetchMessages,
  type ConversationWithContact,
} from "./lib/api";
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

  /** Fetch conversations on mount */
  useEffect(() => {
    fetchConversations()
      .then((data) => {
        setConversations(data);
        if (data.length > 0) setActiveId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  /** Fetch messages when the active conversation changes + poll every 5s for inbound */
  useEffect(() => {
    if (!activeId) return;
    fetchMessages(activeId).then(setActiveMessages);

    const interval = setInterval(() => {
      fetchMessages(activeId).then(setActiveMessages);
      // Also refresh conversation list to update unreadCount / lastMessage
      fetchConversations().then(setConversations);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeId]);

  /** Handle conversation selection */
  function handleSelect(id: string) {
    setActiveMessages([]);
    setActiveId(id);
  }

  /** Handle message sent */
  function handleSent(message: Message) {
    setActiveMessages((prev) => [...prev, message]);
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === message.conversationId
          ? {
              ...conv,
              lastMessageAt: message.timestamp,
              lastMessage: message.content,
              unreadCount: 0,
            }
          : conv,
      ),
    );
  }

  const contacts: Contact[] = conversations.map((c) => c.contact);

  const filtered = conversations.filter((conv) => {
    if (filterChannel !== "all" && conv.channel !== filterChannel) return false;
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
      />

      {activeConv && activeContact ? (
        <>
          <MessageThread
            conversation={activeConv}
            messages={activeMessages}
            contact={activeContact}
            onSent={handleSent}
          />

          <ContactPanel contact={activeContact} conversation={activeConv} />
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
