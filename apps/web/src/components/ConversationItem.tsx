import type { Contact, Conversation } from "../types";
import Avatar from "./Avatar";
import StatusBadge from "./StatusBadge";
import ChannelIcon from "./ChannelIcon";
import { formatTime, stripHtml } from "../utils/helpers";

interface ConversationItemProps {
  conversation: Conversation;
  contact: Contact;
  isActive: boolean;
  onClick: () => void;
}

export default function ConversationItem({
  conversation,
  contact,
  isActive,
  onClick,
}: ConversationItemProps) {
  const hasUnread = conversation.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-100 hover:bg-gray-50 ${
        isActive
          ? "bg-indigo-50 border-l-2 border-l-indigo-500 pl-[14px]"
          : "border-l-2 border-l-transparent"
      }`}
    >
      {/* Avatar with unread dot */}
      <div className="relative flex-shrink-0 mt-0.5">
        <Avatar
          name={contact.name}
          colorClass={contact.avatarColor}
          size="md"
        />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: name + time */}
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={`text-sm truncate ${
              hasUnread
                ? "font-semibold text-gray-900"
                : "font-medium text-gray-700"
            }`}
          >
            {contact.name}
          </span>

          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {(conversation.channels ?? [conversation.channel]).map((ch) => (
              <ChannelIcon key={ch} channel={ch} size={11} />
            ))}
            <span className="text-xs text-gray-400">
              {formatTime(conversation.lastMessageAt)}
            </span>
          </div>
        </div>

        {/* Row 2: subject */}
        <p className="text-xs text-gray-500 truncate mb-0.5">
          {stripHtml(conversation.subject)}
        </p>

        {/* Row 3: last message */}
        <p
          className={`text-xs truncate mb-2 ${
            hasUnread ? "text-gray-700 font-medium" : "text-gray-400"
          }`}
        >
          {conversation.channel === "call"
            ? `📞 ${stripHtml(conversation.lastMessage)}`
            : stripHtml(conversation.lastMessage)}
        </p>

        {/* Row 4: badge + unread count */}
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={conversation.status} />

          {hasUnread && (
            <span className="flex-shrink-0 text-xs bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
