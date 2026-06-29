import {
  Mail,
  MessageCircle,
  MessageSquare,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  PhoneOff,
  Play,
  FileText,
} from "lucide-react";
import type { Message } from "../types";
import { formatTime } from "../utils/helpers";

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);

interface MessageBubbleProps {
  message: Message;
}

// ── Call card (centered) ────────────────────────────────────────────────────
function CallCard({ message }: { message: Message }) {
  const { meta, direction, timestamp, content } = message;
  const status = meta?.status;
  const recordingUrl = meta?.recordingUrl;

  // Icon + colors based on direction × status
  let Icon = PhoneIncoming;
  let colors = "border-green-200 bg-green-50";
  let iconCls = "text-green-500";

  if (direction === "inbound" && status !== "completed") {
    // Missed inbound (no-answer / busy / failed)
    Icon = PhoneMissed;
    colors = "border-red-200 bg-red-50";
    iconCls = "text-red-500";
  } else if (direction === "outbound" && status === "completed") {
    // Answered outbound
    Icon = PhoneOutgoing;
    colors = "border-blue-200 bg-blue-50";
    iconCls = "text-blue-500";
  } else if (direction === "outbound") {
    // Outbound not answered
    Icon = PhoneOff;
    colors = "border-orange-200 bg-orange-50";
    iconCls = "text-orange-500";
  }
  // else: inbound completed → PhoneIncoming green (default)

  return (
    <div className="flex justify-center my-3">
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-sm ${colors}`}
      >
        <Icon size={15} className={iconCls} />

        <div>
          <p className="text-xs font-semibold text-gray-700">{content}</p>
          <p className="text-xs text-gray-400">{formatTime(timestamp)}</p>
        </div>

        {recordingUrl && (
          <a
            href={recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 ml-2 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <Play size={12} />
            Écouter
          </a>
        )}
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

        {/* Attachments (images + PDF/documents) */}
        {message.meta?.mediaUrls && message.meta.mediaUrls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.meta.mediaUrls.map((url, i) =>
              isImageUrl(url) ? (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`pièce jointe ${i + 1}`}
                    className="max-h-48 max-w-[200px] rounded-lg object-cover border border-white/20 cursor-pointer hover:opacity-90 transition-opacity"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                </a>
              ) : (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-opacity hover:opacity-90 ${
                    isOut
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-gray-200 bg-gray-50 text-gray-700"
                  }`}
                >
                  <FileText size={14} />
                  <span className="truncate max-w-[160px]">
                    {decodeURIComponent(url.split("/").pop() ?? "pièce jointe")}
                  </span>
                </a>
              ),
            )}
          </div>
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
