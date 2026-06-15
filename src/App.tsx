import { useState } from "react";
import { Inbox } from "lucide-react";
import { conversations, contacts, messages } from "./data/mockData";
import ConversationList from "./components/ConversationList";
import MessageThread from "./components/MessageThread";
import ContactPanel from "./components/ContactPanel";
import type { FilterChannel, FilterStatus } from "./types";

function App() {
  const [activeId, setActiveId] = useState<string | null>(conversations[0].id);
  const [filterChannel, setFilterChannel] = useState<FilterChannel>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");

  const filtered = conversations.filter((conv) => {
    if (filterChannel !== "all" && conv.channel !== filterChannel) return false;
    if (filterStatus === "treated" && conv.status !== "treated") return false;
    if (filterStatus === "pending" && conv.status === "treated") return false;
    return true;
  });

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const activeContact = activeConv
    ? (contacts.find((c) => c.id === activeConv.contactId) ?? null)
    : null;
  const activeMessages = activeId
    ? messages.filter((m) => m.conversationId === activeId)
    : [];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden antialiased">
      <ConversationList
        conversations={filtered}
        allConversations={conversations}
        contacts={contacts}
        activeConversationId={activeId}
        onSelect={setActiveId}
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
