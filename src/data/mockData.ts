import type { Contact, Conversation, Message } from "../types";

export const contacts: Contact[] = [
  {
    id: "c1",
    name: "Sophie Martin",
    email: "sophie.martin@techcorp.fr",
    phone: "+33 6 12 34 56 78",
    role: "Responsable Achat",
    company: "TechCorp SAS",
    avatarColor: "bg-violet-500",
  },
  {
    id: "c2",
    name: "Thomas Dupont",
    email: "thomas.dupont@constructpro.fr",
    phone: "+33 6 23 45 67 89",
    role: "Directeur Technique",
    company: "ConstructPro",
    avatarColor: "bg-sky-500",
  },
  {
    id: "c3",
    name: "Marie Leclerc",
    email: "marie.leclerc@innov-group.fr",
    phone: "+33 6 34 56 78 90",
    role: "Gérante",
    company: "Innov Group",
    avatarColor: "bg-rose-500",
  },
  {
    id: "c4",
    name: "Julien Bernard",
    email: "j.bernard@batiprime.fr",
    phone: "+33 6 45 67 89 01",
    role: "Chef de Projet",
    company: "BatiPrime",
    avatarColor: "bg-amber-500",
  },
  {
    id: "c5",
    name: "Camille Rousseau",
    email: "c.rousseau@archi-studio.fr",
    phone: "+33 6 56 78 90 12",
    role: "Architecte",
    company: "Archi Studio",
    avatarColor: "bg-emerald-500",
  },
  {
    id: "c6",
    name: "Pierre Moreau",
    email: "p.moreau@logiplex.fr",
    phone: "+33 7 67 89 01 23",
    role: "Acheteur",
    company: "Logiplex",
    avatarColor: "bg-indigo-500",
  },
];

export const conversations: Conversation[] = [
  {
    id: "conv1",
    contactId: "c1",
    subject: "Demande de devis — Charpente bois",
    status: "to_attach",
    channel: "mail",
    unreadCount: 3,
    lastMessageAt: "2026-06-15T09:42:00Z",
    lastMessage:
      "Pouvez-vous me confirmer la disponibilité pour semaine prochaine ?",
  },
  {
    id: "conv2",
    contactId: "c2",
    subject: "Suivi chantier Dupont — Phase 2",
    status: "to_plan",
    channel: "whatsapp",
    unreadCount: 1,
    lastMessageAt: "2026-06-15T08:15:00Z",
    lastMessage: "RDV confirmé pour jeudi 9h00 sur site 👍",
  },
  {
    id: "conv3",
    contactId: "c3",
    subject: "Devis extension bureau — Leclerc",
    status: "quote_after_meeting",
    channel: "mail",
    unreadCount: 0,
    lastMessageAt: "2026-06-14T16:30:00Z",
    lastMessage: "Merci pour votre visite, j'attends votre proposition.",
  },
  {
    id: "conv4",
    contactId: "c4",
    subject: "Livraison matériaux — BatiPrime",
    status: "waiting",
    channel: "sms",
    unreadCount: 2,
    lastMessageAt: "2026-06-14T11:20:00Z",
    lastMessage: "Tj pas reçu la livraison. Vous pouvez rappeler ?",
  },
  {
    id: "conv5",
    contactId: "c5",
    subject: "Projet rénovation Villa Rousseau",
    status: "to_attach",
    channel: "call",
    unreadCount: 1,
    lastMessageAt: "2026-06-13T14:05:00Z",
    lastMessage: "Appel manqué · 2 min 34s",
  },
  {
    id: "conv6",
    contactId: "c6",
    subject: "Commande #2024-0892 — Logiplex",
    status: "treated",
    channel: "mail",
    unreadCount: 0,
    lastMessageAt: "2026-06-13T10:00:00Z",
    lastMessage: "Parfait, la commande a bien été enregistrée. Merci !",
  },
];

export const messages: Message[] = [
  // ── conv1 · Sophie Martin : mail + appel ──────────────────────────────────
  {
    id: "m1",
    conversationId: "conv1",
    channel: "mail",
    direction: "inbound",
    content:
      "Bonjour,\n\nSuite à notre échange téléphonique, je vous contacte pour obtenir un devis pour la fourniture et pose d'une charpente bois pour notre entrepôt de 450 m². Pourriez-vous me faire parvenir une proposition détaillée avant fin de semaine ?\n\nCordialement,\nSophie Martin",
    timestamp: "2026-06-13T08:30:00Z",
    meta: { subject: "Demande de devis — Charpente bois" },
  },
  {
    id: "m2",
    conversationId: "conv1",
    channel: "call",
    direction: "outbound",
    content: "Appel sortant vers Sophie Martin",
    timestamp: "2026-06-13T10:15:00Z",
    meta: { callStatus: "outbound", duration: 245 },
  },
  {
    id: "m3",
    conversationId: "conv1",
    channel: "mail",
    direction: "outbound",
    content:
      "Bonjour Sophie,\n\nMerci pour votre message. Nous avons bien pris note de votre demande. Je vous prépare un devis détaillé que vous recevrez d'ici vendredi. N'hésitez pas à me joindre si vous avez des questions.\n\nCordialement,\nÉquipe Commerciale",
    timestamp: "2026-06-13T14:00:00Z",
    meta: { subject: "RE: Demande de devis — Charpente bois" },
  },
  {
    id: "m4",
    conversationId: "conv1",
    channel: "mail",
    direction: "inbound",
    content:
      "Bonjour,\n\nMerci pour votre retour. Une précision : il faudrait inclure aussi la zinguerie. Pouvez-vous me confirmer la disponibilité pour semaine prochaine ?",
    timestamp: "2026-06-15T09:42:00Z",
    meta: { subject: "RE: Demande de devis — Charpente bois" },
  },

  // ── conv2 · Thomas Dupont : WhatsApp + appel manqué ───────────────────────
  {
    id: "m5",
    conversationId: "conv2",
    channel: "whatsapp",
    direction: "outbound",
    content:
      "Bonjour Thomas, on confirme le RDV de jeudi pour la visite chantier phase 2 ?",
    timestamp: "2026-06-14T09:00:00Z",
  },
  {
    id: "m6",
    conversationId: "conv2",
    channel: "call",
    direction: "inbound",
    content: "Appel entrant de Thomas Dupont",
    timestamp: "2026-06-14T09:28:00Z",
    meta: { callStatus: "missed" },
  },
  {
    id: "m7",
    conversationId: "conv2",
    channel: "whatsapp",
    direction: "inbound",
    content:
      "Désolé j'ai raté votre appel ! Oui c'est ok pour jeudi, on se retrouve à 9h sur le chantier.",
    timestamp: "2026-06-14T11:15:00Z",
  },
  {
    id: "m8",
    conversationId: "conv2",
    channel: "whatsapp",
    direction: "inbound",
    content: "RDV confirmé pour jeudi 9h00 sur site 👍",
    timestamp: "2026-06-15T08:15:00Z",
  },

  // ── conv3 · Marie Leclerc : mail + appel + WhatsApp ───────────────────────
  {
    id: "m9",
    conversationId: "conv3",
    channel: "mail",
    direction: "inbound",
    content:
      "Bonjour,\n\nJe souhaiterais obtenir un devis pour l'extension de mon bureau (environ 30 m²). Nous sommes disponibles pour une visite la semaine prochaine.\n\nBien cordialement,\nMarie Leclerc",
    timestamp: "2026-06-13T08:00:00Z",
    meta: { subject: "Devis extension bureau" },
  },
  {
    id: "m10",
    conversationId: "conv3",
    channel: "call",
    direction: "outbound",
    content: "Appel sortant vers Marie Leclerc",
    timestamp: "2026-06-13T10:30:00Z",
    meta: { callStatus: "outbound", duration: 420 },
  },
  {
    id: "m11",
    conversationId: "conv3",
    channel: "whatsapp",
    direction: "outbound",
    content:
      "Bonjour Marie, je vous confirme notre visite lundi prochain à 14h30. À lundi ! 😊",
    timestamp: "2026-06-13T11:00:00Z",
  },
  {
    id: "m12",
    conversationId: "conv3",
    channel: "whatsapp",
    direction: "inbound",
    content: "Parfait, c'est noté ! À lundi.",
    timestamp: "2026-06-13T11:10:00Z",
  },
  {
    id: "m13",
    conversationId: "conv3",
    channel: "mail",
    direction: "inbound",
    content:
      "Bonjour,\n\nMerci pour votre visite, j'attends votre proposition.\n\nCordialement",
    timestamp: "2026-06-14T16:30:00Z",
    meta: { subject: "Devis extension bureau — Leclerc" },
  },

  // ── conv4 · Julien Bernard : SMS + appel manqué ───────────────────────────
  {
    id: "m14",
    conversationId: "conv4",
    channel: "sms",
    direction: "outbound",
    content:
      "Bonjour Julien, votre commande de matériaux est en cours de préparation, livraison prévue demain matin.",
    timestamp: "2026-06-13T14:00:00Z",
  },
  {
    id: "m15",
    conversationId: "conv4",
    channel: "call",
    direction: "inbound",
    content: "Appel entrant de Julien Bernard",
    timestamp: "2026-06-14T09:05:00Z",
    meta: { callStatus: "missed" },
  },
  {
    id: "m16",
    conversationId: "conv4",
    channel: "sms",
    direction: "inbound",
    content: "Tj pas reçu la livraison. Vous pouvez rappeler ?",
    timestamp: "2026-06-14T11:20:00Z",
  },

  // ── conv5 · Camille Rousseau : WhatsApp + appels ──────────────────────────
  {
    id: "m17",
    conversationId: "conv5",
    channel: "whatsapp",
    direction: "inbound",
    content:
      "Bonjour, je vous contacte pour le projet de rénovation de la Villa Rousseau. Pouvez-vous me rappeler ?",
    timestamp: "2026-06-13T10:00:00Z",
  },
  {
    id: "m18",
    conversationId: "conv5",
    channel: "call",
    direction: "outbound",
    content: "Appel sortant vers Camille Rousseau",
    timestamp: "2026-06-13T10:30:00Z",
    meta: { callStatus: "outbound", duration: 180 },
  },
  {
    id: "m19",
    conversationId: "conv5",
    channel: "call",
    direction: "inbound",
    content: "Appel entrant de Camille Rousseau",
    timestamp: "2026-06-13T14:05:00Z",
    meta: { callStatus: "missed", duration: 154 },
  },

  // ── conv6 · Pierre Moreau : mail uniquement ───────────────────────────────
  {
    id: "m20",
    conversationId: "conv6",
    channel: "mail",
    direction: "inbound",
    content:
      "Bonjour,\n\nJe souhaite passer commande pour les références suivantes :\n- REF-001 (×10)\n- REF-045 (×5)\n- REF-112 (×2)\n\nMerci de confirmer la disponibilité et les délais.\n\nCordialement,\nPierre Moreau",
    timestamp: "2026-06-13T09:00:00Z",
    meta: { subject: "Commande #2024-0892" },
  },
  {
    id: "m21",
    conversationId: "conv6",
    channel: "mail",
    direction: "outbound",
    content:
      "Bonjour Pierre,\n\nNous avons bien enregistré votre commande #2024-0892. Toutes les références sont disponibles, livraison estimée sous 3 à 5 jours ouvrés.\n\nCordialement,\nÉquipe Commerciale",
    timestamp: "2026-06-13T09:45:00Z",
    meta: { subject: "RE: Commande #2024-0892" },
  },
  {
    id: "m22",
    conversationId: "conv6",
    channel: "mail",
    direction: "inbound",
    content: "Parfait, la commande a bien été enregistrée. Merci !",
    timestamp: "2026-06-13T10:00:00Z",
    meta: { subject: "RE: Commande #2024-0892" },
  },
];
