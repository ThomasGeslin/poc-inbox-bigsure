import { useState, useEffect, useRef } from "react";
import { X, Check, Mail, Phone, Briefcase, User, Pencil } from "lucide-react";
import type { Contact } from "../types";
import { updateContact } from "../lib/api";
import Avatar from "./Avatar";
import { useToast } from "./useToast";
import PhoneInputField from "./PhoneInputField";

interface EditContactModalProps {
  contact: Contact;
  onClose: () => void;
  onSaved: (updated: Contact) => void;
}

interface EditForm {
  name: string;
  email: string;
  phone: string;
  role: string;
  company: string;
}

export default function EditContactModal({
  contact,
  onClose,
  onSaved,
}: EditContactModalProps) {
  const toast = useToast();

  const [form, setForm] = useState<EditForm>({
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    role: contact.role,
    company: contact.company,
  });
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input on open
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleChange(field: keyof EditForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateContact(contact.id, form);
      onSaved({ ...updated, avatarColor: contact.avatarColor });
      toast("success", "Contact mis à jour");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      let userMessage = "Impossible de mettre à jour le contact";
      if (msg.includes("not found")) {
        userMessage =
          "Ce contact est introuvable. Il a peut-être été supprimé.";
      } else if (
        msg.toLowerCase().includes("unique") ||
        msg.toLowerCase().includes("already exists")
      ) {
        userMessage = "Un contact avec cet e-mail ou ce téléphone existe déjà.";
      } else if (msg.includes("validation") || msg.includes("invalid")) {
        userMessage =
          "Les informations saisies sont invalides. Vérifiez les champs.";
      }
      toast("error", userMessage);
    } finally {
      setSaving(false);
    }
  }

  const fields: {
    key: keyof EditForm;
    label: string;
    Icon: React.ElementType;
    type?: string;
    placeholder?: string;
  }[] = [
    {
      key: "name",
      label: "Nom complet",
      Icon: User,
      placeholder: "Jean Dupont",
    },
    {
      key: "email",
      label: "Email",
      Icon: Mail,
      type: "email",
      placeholder: "jean@example.com",
    },
    {
      key: "phone",
      label: "Téléphone",
      Icon: Phone,
      type: "tel",
      placeholder: "+33 6 00 00 00 00",
    },
    { key: "role", label: "Rôle", Icon: Pencil, placeholder: "Commercial" },
    {
      key: "company",
      label: "Entreprise",
      Icon: Briefcase,
      placeholder: "Acme Corp",
    },
  ];

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Avatar
              name={form.name || contact.name}
              colorClass={contact.avatarColor}
              size="sm"
            />

            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                {form.name || contact.name}
              </p>

              <p className="text-xs text-gray-400">Modifier le contact</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {fields.map(({ key, label, Icon, type, placeholder }, i) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {label}
              </label>

              {key === "phone" ? (
                <PhoneInputField
                  value={form.phone}
                  onChange={(v) => handleChange("phone", v)}
                  variant="edit"
                />
              ) : (
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <Icon size={14} />
                  </div>

                  <input
                    ref={i === 0 ? firstInputRef : undefined}
                    type={type ?? "text"}
                    value={form[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-3 py-2 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            <Check size={14} />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
