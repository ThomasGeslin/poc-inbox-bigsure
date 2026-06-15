import { useEffect, useRef } from "react";
import { Archive, UserPlus, MoreHorizontal } from "lucide-react";
import type { Contact, Conversation, Message } from "../types";
import Avatar from "./Avatar";
import StatusBadge from "./StatusBadge";
import MessageBubble from "./MessageBubble";
import ReplyBox from "./ReplyBox";
import { getDateLabel } from "../utils/helpers";

interface MessageThreadProps {
  conversation: Conversation;
  messages: Message[];
  contact: Contact;
}

/** Group messages by calendar day for date separators */
function groupByDate(
  messages: Message[],
): { label: string; msgs: Message[] }[] {
  const groups: { label: string; msgs: Message[] }[] = [];
  let current = "";

  for (const msg of messages) {
    const label = getDateLabel(msg.timestamp);

    if (label !== current) {
      current = label;
      groups.push({ label, msgs: [msg] });
    } else {
      groups[groups.length - 1].msgs.push(msg);
    }
  }
  return groups;
}

export default function MessageThread({
  conversation,
  messages,
  contact,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const groups = groupByDate(messages);

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-gray-50 overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-start gap-4 flex-shrink-0">
        <Avatar
          name={contact.name}
          colorClass={contact.avatarColor}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {conversation.subject}
            </h2>

            <StatusBadge status={conversation.status} />
          </div>

          <p className="text-xs text-gray-500 mt-0.5">
            {contact.name} · {contact.company}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Archiver"
          >
            <Archive size={15} />
          </button>

          <button
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Assigner"
          >
            <UserPlus size={15} />
          </button>

          <button
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Plus d'actions"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      </header>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {groups.map(({ label, msgs }) => (
          <div key={label}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium tracking-wider">
                {label}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {msgs.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Reply box ───────────────────────────────────────────────────── */}
      <ReplyBox conversationId={conversation.id} />
    </main>
  );
}
