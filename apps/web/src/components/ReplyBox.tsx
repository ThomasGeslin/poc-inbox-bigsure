import { useState } from "react";
import {
  Send,
  Paperclip,
  Mail,
  MessageSquare,
  MessageCircle,
} from "lucide-react";
import type { Channel } from "../types";

type ReplyChannel = Exclude<Channel, "call">;

const TABS: {
  key: ReplyChannel;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { key: "mail", label: "Mail", Icon: Mail },
  { key: "sms", label: "SMS", Icon: MessageSquare },
  { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
];

const PLACEHOLDER: Record<ReplyChannel, string> = {
  mail: "Rédigez votre email…",
  sms: "Message SMS…",
  whatsapp: "Message WhatsApp…",
};

interface ReplyBoxProps {
  conversationId: string;
}

export default function ReplyBox({ conversationId: _ }: ReplyBoxProps) {
  const [channel, setChannel] = useState<ReplyChannel>("mail");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");

  const canSend = body.trim().length > 0;

  function handleSend() {
    if (!canSend) return;
    // TODO: wire to backend / state
    setBody("");
    setSubject("");
  }

  return (
    <div className="border-t border-gray-200 bg-white flex-shrink-0">
      {/* Channel selector tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setChannel(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
              channel === key
                ? "border-indigo-500 text-indigo-600 bg-indigo-50"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-3 pt-2">
        {/* Subject for mail */}
        {channel === "mail" && (
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Objet…"
            className="w-full text-xs text-gray-700 border-b border-gray-200 pb-2 mb-2 focus:outline-none focus:border-indigo-300 bg-transparent placeholder:text-gray-400"
          />
        )}

        {/* Textarea */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={PLACEHOLDER[channel]}
          rows={3}
          className="w-full text-sm text-gray-800 resize-none focus:outline-none placeholder:text-gray-400 leading-relaxed"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
          }}
        />

        {/* Actions bar */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            title="Pièce jointe"
          >
            <Paperclip size={15} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">
              ⌘ + ↵ pour envoyer
            </span>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Envoyer
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
