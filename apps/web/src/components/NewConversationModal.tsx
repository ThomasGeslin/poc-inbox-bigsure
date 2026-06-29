import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Search,
  Send,
  Mail,
  MessageSquare,
  MessageCircle,
  Loader2,
  Paperclip,
  FileText,
} from "lucide-react";
import type { Channel, Contact } from "../types";
import { fetchContacts, startConversation } from "../lib/api";
import type { ConversationWithContact } from "../lib/api";
import { useToast } from "./useToast";
import Avatar from "./Avatar";

type ComposeChannel = Exclude<Channel, "call">;

const CHANNELS: {
  key: ComposeChannel;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { key: "mail", label: "Mail", Icon: Mail },
  { key: "sms", label: "SMS", Icon: MessageSquare },
  { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
];

const PLACEHOLDER: Record<ComposeChannel, string> = {
  mail: "Rédigez votre email…",
  sms: "Message SMS…",
  whatsapp: "Message WhatsApp…",
};

interface NewConversationModalProps {
  onClose: () => void;
  onStarted: (conversation: ConversationWithContact) => void;
}

export default function NewConversationModal({
  onClose,
  onStarted,
}: NewConversationModalProps) {
  const toast = useToast();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);

  const [channel, setChannel] = useState<ComposeChannel>("mail");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only mail and whatsapp support attachments in this POC (mirrors ReplyBox).
  const supportsAttachments = channel === "mail" || channel === "whatsapp";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = ""; // reset so the same file can be re-selected
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  /** Load contacts on mount */
  useEffect(() => {
    fetchContacts()
      .then(setContacts)
      .catch(() => toast("error", "Impossible de charger les contacts"))
      .finally(() => setLoadingContacts(false));
  }, [toast]);

  /** Close on Escape */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasEmail = !!selected?.email?.trim();
  const hasPhone = !!selected?.phone?.trim();

  /** Which channels the selected contact can be reached on */
  const availableChannels = useMemo(
    () => CHANNELS.filter(({ key }) => (key === "mail" ? hasEmail : hasPhone)),
    [hasEmail, hasPhone],
  );

  /** Select a contact and default the channel to one they can be reached on */
  function selectContact(contact: Contact) {
    setSelected(contact);
    const firstChannel = contact.email?.trim()
      ? "mail"
      : contact.phone?.trim()
        ? "sms"
        : "mail";
    setChannel(firstChannel);
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query),
    );
  }, [contacts, search]);

  const showSubject = channel === "mail";
  const canSend =
    !!selected &&
    body.trim().length > 0 &&
    !sending &&
    availableChannels.length > 0;

  async function handleSend() {
    if (!canSend || !selected) return;

    setSending(true);

    // Mirror ReplyBox: mail bodies are sent as HTML.
    const content =
      channel === "mail"
        ? `<p>${body.trim().replace(/\n/g, "<br>")}</p>`
        : body.trim();

    try {
      const conversation = await startConversation({
        contactId: selected.id,
        channel,
        content,
        subject: showSubject && subject.trim() ? subject.trim() : undefined,
        attachments:
          supportsAttachments && attachments.length > 0
            ? attachments
            : undefined,
      });

      toast("success", "Conversation démarrée");
      onStarted(conversation);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      let userMessage = "Impossible de démarrer la conversation";
      if (msg.includes("no email address")) {
        userMessage =
          "Ce contact n'a pas d'adresse e-mail. Choisissez un autre canal.";
      } else if (msg.includes("no phone number")) {
        userMessage =
          "Ce contact n'a pas de numéro de téléphone. Choisissez un autre canal.";
      } else if (msg.includes("Invalid phone number")) {
        userMessage =
          "Le numéro de téléphone du contact est invalide (ex. +33612345678).";
      }
      toast("error", userMessage);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              Nouvelle conversation
            </p>
            <p className="text-xs text-gray-400">
              {selected
                ? `Avec ${selected.name}`
                : "Choisissez un contact existant"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {!selected ? (
          /* ── Step 1: pick a contact ─────────────────────────────────── */
          <div className="flex flex-col min-h-0">
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un contact…"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="overflow-y-auto px-3 pb-4 min-h-[12rem]">
              {loadingContacts ? (
                <div className="flex items-center justify-center h-32 text-gray-400">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-xs text-gray-400">
                  Aucun contact trouvé
                </div>
              ) : (
                filtered.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => selectContact(contact)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left hover:cursor-pointer"
                  >
                    <Avatar
                      name={contact.name}
                      colorClass={contact.avatarColor}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {contact.email || contact.phone || "—"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* ── Step 2: compose the first message ──────────────────────── */
          <div className="flex flex-col min-h-0">
            <div className="px-6 pt-4 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-indigo-600 hover:text-indigo-700 hover:cursor-pointer"
              >
                ← Changer de contact
              </button>

              {/* Channel selector */}
              <div className="flex items-center gap-1 mt-3">
                {CHANNELS.map(({ key, label, Icon }) => {
                  const enabled = key === "mail" ? hasEmail : hasPhone;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!enabled}
                      onClick={() => {
                        setChannel(key);
                        if (key === "sms") setAttachments([]);
                      }}
                      title={
                        enabled
                          ? undefined
                          : key === "mail"
                            ? "Ce contact n'a pas d'email"
                            : "Ce contact n'a pas de téléphone"
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        channel === key
                          ? "border-indigo-500 text-indigo-600 bg-indigo-50"
                          : "border-gray-200 text-gray-500 hover:text-gray-700"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <Icon size={11} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-3 overflow-y-auto">
              {showSubject && (
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Objet…"
                  className="w-full text-sm text-gray-700 border-b border-gray-200 pb-2 mb-3 focus:outline-none focus:border-indigo-300 bg-transparent placeholder:text-gray-400"
                />
              )}

              <textarea
                autoFocus
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={PLACEHOLDER[channel]}
                rows={5}
                className="w-full text-sm text-gray-800 resize-none focus:outline-none placeholder:text-gray-400 leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    handleSend();
                }}
              />

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
                  {body.length}/160
                </div>
              )}

              {/* Attachment previews */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
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
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
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
                    title="Ajouter une pièce jointe (image ou PDF)"
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors hover:cursor-pointer"
                  >
                    <Paperclip size={15} />
                  </button>
                </>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors hover:cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:cursor-pointer"
                >
                  {sending ? "Envoi…" : "Envoyer"}
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
