import { useRef, useState } from "react";
import {
  Send,
  Paperclip,
  Mail,
  MessageSquare,
  MessageCircle,
  FileText,
  X,
} from "lucide-react";
import type { Channel, Message } from "../types";
import { sendMessage } from "../lib/api";
import { useToast } from "./useToast";

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
  messages: Message[];
  contact: { email: string; phone: string };
  onSent: (message: Message) => void;
}

export default function ReplyBox({
  conversationId,
  messages,
  contact,
  onSent,
}: ReplyBoxProps) {
  const toast = useToast();

  const [channel, setChannel] = useState<ReplyChannel>("mail");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only mail and whatsapp support attachments (SMS technically supports MMS but
  // let's restrict to channels where it's well-supported in this POC)
  const supportsAttachments = channel === "mail" || channel === "whatsapp";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...files].slice(0, 5));
    // reset so same file can be re-selected
    e.target.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  // Show the subject field only when composing mail and no prior mail exists
  const hasPriorMail = messages.some((m) => m.channel === "mail");
  const showSubject = channel === "mail" && !hasPriorMail;

  const hasPhone = (contact.phone ?? "").trim().length > 0;
  const hasEmail = (contact.email ?? "").trim().length > 0;
  const channelReady =
    (channel === "mail" && hasEmail) ||
    ((channel === "sms" || channel === "whatsapp") && hasPhone);
  const canSend =
    (body.trim().length > 0 || attachments.length > 0) &&
    !sending &&
    channelReady;

  function handleSend() {
    if (!canSend) return;

    setSending(true);

    // Wrap mail content in HTML paragraph(s)
    const content =
      channel === "mail"
        ? `<p>${body.trim().replace(/\n/g, "<br>")}</p>`
        : body.trim();

    sendMessage(conversationId, {
      channel,
      content,
      subject: showSubject && subject.trim() ? subject.trim() : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    })
      .then((msg) => {
        onSent(msg);
        setBody("");
        setSubject("");
        setAttachments([]);
        toast("success", "Message envoyé");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "";
        let userMessage = "Impossible d'envoyer le message";
        if (msg.includes("no email address")) {
          userMessage =
            "Ce contact n'a pas d'adresse e-mail. Ajoutez-en une avant d'envoyer un mail.";
        } else if (msg.includes("no phone number")) {
          userMessage =
            "Ce contact n'a pas de numéro de téléphone. Ajoutez-en un avant d'envoyer un SMS ou WhatsApp.";
        } else if (msg.includes("Invalid phone number")) {
          userMessage =
            "Le numéro de téléphone du contact est invalide. Vérifiez le format (ex. +33612345678).";
        }
        toast("error", userMessage);
      })
      .finally(() => setSending(false));
  }

  return (
    <div className="border-t border-gray-200 bg-white flex-shrink-0">
      {/* Channel selector tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => {
              setChannel(key);
              if (key === "sms") setAttachments([]);
            }}
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
        {/* Subject for first mail in conversation */}
        {showSubject && (
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

        {/* SMS character counter */}
        {channel === "sms" && (
          <div
            className={`text-xs text-right mt-1 ${
              body.length > 160
                ? "text-red-500"
                : body.length >= 140
                  ? "text-orange-400"
                  : "text-gray-400"
            }`}
          >
            {body.length > 160
              ? `${body.length}/160 — Envoi en ${Math.ceil(body.length / 160)} segments`
              : `${body.length}/160`}
          </div>
        )}

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {attachments.map((file, idx) => (
              <div key={idx} className="relative group">
                {file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-14 w-14 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div
                    className="h-14 w-14 flex flex-col items-center justify-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-1"
                    title={file.name}
                  >
                    <FileText size={18} className="text-gray-400" />
                    <span className="text-[9px] text-gray-500 truncate max-w-full">
                      {file.name.split(".").pop()?.toUpperCase()}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="absolute -top-1.5 -right-1.5 bg-white border border-gray-200 rounded-full p-0.5 text-gray-500 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
          {supportsAttachments ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                title="Ajouter une pièce jointe (image ou PDF)"
              >
                <Paperclip size={15} />
              </button>
            </>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">
              ⌘ + ↵ pour envoyer
            </span>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:cursor-pointer"
            >
              {sending ? "Envoi…" : "Envoyer"}
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
