import { useState } from "react";
import {
  Inbox,
  Search,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  UserPlus,
} from "lucide-react";
import type {
  Contact,
  Conversation,
  FilterChannel,
  FilterStatus,
} from "../types";
import ConversationItem from "./ConversationItem";
import CreateContactModal from "./CreateContactModal";

interface ConversationListProps {
  conversations: Conversation[];
  allConversations: Conversation[];
  contacts: Contact[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  filterChannel: FilterChannel;
  onFilterChannel: (ch: FilterChannel) => void;
  filterStatus: FilterStatus;
  onFilterStatus: (s: FilterStatus) => void;
  onContactCreated?: (contact: Contact) => void;
}

const CHANNEL_TABS: {
  key: FilterChannel;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon?: React.ComponentType<any>;
}[] = [
  { key: "all", label: "Tous" },
  { key: "mail", label: "Mail", Icon: Mail },
  { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  { key: "sms", label: "SMS", Icon: MessageSquare },
  { key: "call", label: "Appels", Icon: Phone },
];

export default function ConversationList({
  conversations,
  allConversations,
  contacts,
  activeConversationId,
  onSelect,
  filterChannel,
  onFilterChannel,
  filterStatus,
  onFilterStatus,
  onContactCreated,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const pendingCount = allConversations.filter(
    (conv) => conv.status !== "treated",
  ).length;

  const treatedCount = allConversations.filter(
    (conv) => conv.status === "treated",
  ).length;

  const totalUnread = allConversations.reduce(
    (sum, conv) => sum + conv.unreadCount,
    0,
  );

  const displayed = conversations.filter((conv) => {
    if (!search) return true;

    const contact = contacts.find((contact) => contact.id === conv.contactId);
    const query = search.toLowerCase();

    return (
      contact?.name.toLowerCase().includes(query) ||
      conv.subject.toLowerCase().includes(query) ||
      conv.lastMessage.toLowerCase().includes(query)
    );
  });

  return (
    <aside className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Inbox size={18} className="text-indigo-600" />

          <h1 className="text-sm font-semibold text-gray-900">Boîte unifiée</h1>
          {totalUnread > 0 && (
            <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {totalUnread} nouveaux
            </span>
          )}
        </div>
      </div>

      {/* ── Channel tabs ──────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-100 overflow-x-auto">
        {CHANNEL_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onFilterChannel(key)}
            className={`flex items-center gap-1 px-3 py-2.5 text-xs font-medium whitespace-nowrap flex-shrink-0 border-b-2 transition-colors ${
              filterChannel === key
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {Icon && <Icon size={11} />}
            {label}
          </button>
        ))}
      </div>

      {/* ── Status tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-3 py-2 border-b border-gray-100">
        <button
          onClick={() => onFilterStatus("pending")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filterStatus === "pending"
              ? "bg-gray-100 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          À traiter{" "}
          <span
            className={
              filterStatus === "pending" ? "text-gray-500" : "text-gray-400"
            }
          >
            ({pendingCount})
          </span>
        </button>

        <button
          onClick={() => onFilterStatus("treated")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filterStatus === "treated"
              ? "bg-gray-100 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Traité{" "}
          <span
            className={
              filterStatus === "treated" ? "text-gray-500" : "text-gray-400"
            }
          >
            ({treatedCount})
          </span>
        </button>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1 text-gray-400">
            <Inbox size={28} className="text-gray-300" />
            <p className="text-xs">Aucune conversation</p>
          </div>
        ) : (
          displayed.map((conv) => {
            const contact = contacts.find((c) => c.id === conv.contactId);
            if (!contact) return null;
            return (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                contact={contact}
                isActive={conv.id === activeConversationId}
                onClick={() => onSelect(conv.id)}
              />
            );
          })
        )}
      </div>

      {/* ── New contact button ────────────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors hover:cursor-pointer"
        >
          <UserPlus size={13} />
          Nouveau contact
        </button>
      </div>

      {createModalOpen && (
        <CreateContactModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={(contact) => {
            onContactCreated?.(contact);
            setCreateModalOpen(false);
          }}
        />
      )}
    </aside>
  );
}
