import type { ConversationStatus } from "../types";

interface Cfg {
  label: string;
  className: string;
}

const STATUS_CFG: Record<ConversationStatus, Cfg> = {
  to_attach: {
    label: "À rattacher",
    className: "bg-orange-100 text-orange-700",
  },
  to_plan: { label: "À planifier", className: "bg-yellow-100 text-yellow-700" },
  quote_after_meeting: {
    label: "Devis suite à RDV",
    className: "bg-blue-100  text-blue-700",
  },
  waiting: { label: "En attente", className: "bg-gray-100  text-gray-600" },
  treated: { label: "Traité", className: "bg-green-100 text-green-700" },
};

interface StatusBadgeProps {
  status: ConversationStatus;
  className?: string;
}

export default function StatusBadge({
  status,
  className = "",
}: StatusBadgeProps) {
  const { label, className: cfg } = STATUS_CFG[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg} ${className}`}
    >
      {label}
    </span>
  );
}
