import {
  Mail,
  MessageCircle,
  MessageSquare,
  PhoneMissed,
  PhoneOutgoing,
  PhoneCall,
} from "lucide-react";
import type { Message } from "../types";
import { formatTime, formatDuration } from "../utils/helpers";

interface MessageBubbleProps {
  message: Message;
}

// ── Call card (centered) ────────────────────────────────────────────────────
function CallCard({ message }: { message: Message }) {
  const { meta, direction, timestamp } = message;
  const status = meta?.callStatus;
  const duration = meta?.duration;

  let Icon = PhoneCall;
  let label = "Appel entrant";
  let colors = "border-green-200 bg-green-50";
  let iconCls = "text-green-500";

  if (status === "missed") {
    Icon = PhoneMissed;
    label = "Appel manqué";
    colors = "border-red-200 bg-red-50";
    iconCls = "text-red-500";
  } else if (status === "outbound" || direction === "outbound") {
    Icon = PhoneOutgoing;
    label = "Appel sortant";
    colors = "border-indigo-200 bg-indigo-50";
    iconCls = "text-indigo-500";
  }

  return (
    <div className="flex justify-center my-3">
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-sm ${colors}`}
      >
        <Icon size={15} className={iconCls} />

        <div>
          <p className="text-xs font-semibold text-gray-700">{label}</p>
          {duration != null && (
            <p className="text-xs text-gray-500">{formatDuration(duration)}</p>
          )}
        </div>

        <span className="text-xs text-gray-400 ml-1">
          {formatTime(timestamp)}
        </span>
      </div>
    </div>
  );
}

// ── Channel indicator icon ──────────────────────────────────────────────────
const CHANNEL_ICON = {
  mail: { Icon: Mail, cls: "text-blue-400" },
  whatsapp: { Icon: MessageCircle, cls: "text-green-400" },
  sms: { Icon: MessageSquare, cls: "text-purple-400" },
} as const;

// ── Main bubble ─────────────────────────────────────────────────────────────
export default function MessageBubble({ message }: MessageBubbleProps) {
  if (message.channel === "call") return <CallCard message={message} />;

  const isOut = message.direction === "outbound";
  const cfg = CHANNEL_ICON[message.channel as keyof typeof CHANNEL_ICON];

  return (
    <div className={`flex mb-3 ${isOut ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[72%] rounded-2xl px-4 py-3 shadow-sm ${
          isOut
            ? "bg-indigo-600 text-white rounded-br-sm"
            : "bg-white text-gray-800 rounded-bl-sm border border-gray-100"
        }`}
      >
        {/* Mail subject */}
        {message.meta?.subject && (
          <p
            className={`text-xs font-semibold mb-1 truncate ${
              isOut ? "text-indigo-200" : "text-gray-400"
            }`}
          >
            {message.meta.subject}
          </p>
        )}

        {/* Body — render HTML for mail, plain text otherwise */}
        {message.channel === "mail" ? (
          <div
            className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-a:text-indigo-300"
            // Content comes from our own backend / Resend — not arbitrary user input
            dangerouslySetInnerHTML={{ __html: message.content }}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        )}

        {/* Footer: channel icon + timestamp */}
        <div
          className={`flex items-center gap-1 mt-1.5 ${isOut ? "justify-end" : "justify-between"}`}
        >
          {!isOut && cfg && <cfg.Icon size={11} className={cfg.cls} />}

          <span
            className={`text-xs ${isOut ? "text-indigo-200" : "text-gray-400"}`}
          >
            {formatTime(message.timestamp)}
          </span>

          {isOut && cfg && <cfg.Icon size={11} className="text-indigo-300" />}
        </div>
      </div>
    </div>
  );
}
