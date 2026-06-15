import {
  Mail,
  Phone,
  Briefcase,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import type { Contact, Conversation } from "../types";
import Avatar from "./Avatar";
import StatusBadge from "./StatusBadge";

// ── Static mock data for the panel ─────────────────────────────────────────
const REFERENT = {
  name: "Antoine Leblanc",
  role: "Commercial Senior",
  avatarColor: "bg-teal-500",
};

const LINKED_ORDER = {
  ref: "#2024-0892",
  label: "Charpente bois 450 m²",
  status: "En cours",
};

interface ContactPanelProps {
  contact: Contact;
  conversation: Conversation;
}

export default function ContactPanel({
  contact,
  conversation,
}: ContactPanelProps) {
  return (
    <aside className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto">
      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center px-6 pt-8 pb-6 border-b border-gray-100">
        <Avatar
          name={contact.name}
          colorClass={contact.avatarColor}
          size="lg"
        />

        <h2 className="mt-3 text-base font-semibold text-gray-900 text-center">
          {contact.name}
        </h2>

        <p className="text-sm text-gray-500 text-center mt-0.5">
          {contact.role}
        </p>

        <p className="text-xs text-gray-400 text-center">{contact.company}</p>

        <div className="mt-3">
          <StatusBadge status={conversation.status} />
        </div>
      </div>

      {/* ── Contact details ───────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-gray-100 space-y-3">
        {[
          { Icon: Mail, label: "Email", value: contact.email },
          { Icon: Phone, label: "Téléphone", value: contact.phone },
          { Icon: Briefcase, label: "Entreprise", value: contact.company },
        ].map(({ Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon size={13} className="text-gray-500" />
            </div>

            <div className="min-w-0">
              <p className="text-xs text-gray-400">{label}</p>

              <p className="text-xs font-medium text-gray-700 truncate">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Referent ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Référent du dossier
        </p>

        <div className="flex items-center gap-3">
          <Avatar
            name={REFERENT.name}
            colorClass={REFERENT.avatarColor}
            size="sm"
          />

          <div>
            <p className="text-sm font-medium text-gray-800">{REFERENT.name}</p>
            <p className="text-xs text-gray-500">{REFERENT.role}</p>
          </div>
        </div>
      </div>

      {/* ── Linked order ──────────────────────────────────────────────────── */}
      <div className="px-4 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Commande rattachée
        </p>

        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-800">
              {LINKED_ORDER.ref}
            </span>

            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {LINKED_ORDER.status}
            </span>
          </div>

          <p className="text-xs text-gray-500 mb-3">{LINKED_ORDER.label}</p>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-lg transition-colors"
          >
            Voir la commande
            <ChevronRight size={13} />
          </button>
        </div>

        <button
          type="button"
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 py-2 rounded-lg transition-colors"
        >
          <ExternalLink size={13} />
          Rattacher à un dossier
        </button>
      </div>
    </aside>
  );
}
