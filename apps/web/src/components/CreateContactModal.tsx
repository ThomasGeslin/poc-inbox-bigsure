import { useState, useEffect, useRef } from "react";
import { X, Check, Mail, Phone, Briefcase, User, Pencil } from "lucide-react";
import type { Contact } from "../types";
import { createContact } from "../lib/api";
import { getAvatarColor } from "../utils/helpers";
import { useToast } from "./useToast";

interface CreateContactModalProps {
  onClose: () => void;
  onCreated: (contact: Contact) => void;
}

interface CreateForm {
  name: string;
  email: string;
  phone: string;
  role: string;
  company: string;
}

export default function CreateContactModal({
  onClose,
  onCreated,
}: CreateContactModalProps) {
  const toast = useToast();

  const [form, setForm] = useState<CreateForm>({
    name: "",
    email: "",
    phone: "",
    role: "",
    company: "",
  });

  const [saving, setSaving] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);

  /** Focus the first input on mount */
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  /** Close modal on Escape key press */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Handle form field change */
  function handleChange(field: keyof CreateForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const canSave =
    form.name.trim().length > 0 &&
    (form.email.trim().length > 0 || form.phone.trim().length > 0);

  /** Handle save button click */
  async function handleSave() {
    if (!canSave) return;

    setSaving(true);

    try {
      const created = await createContact({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        role: form.role || undefined,
        company: form.company || undefined,
      });

      onCreated({ ...created, avatarColor: getAvatarColor(created.id) });
      toast("success", "Contact créé avec succès");
      onClose();
    } catch {
      toast("error", "Impossible de créer le contact");
    } finally {
      setSaving(false);
    }
  }

  const fields: {
    key: keyof CreateForm;
    label: string;
    Icon: React.ElementType;
    type?: string;
    placeholder?: string;
    required?: boolean;
  }[] = [
    {
      key: "name",
      label: "Nom complet",
      Icon: User,
      placeholder: "Jean Dupont",
      required: true,
    },
    {
      key: "email",
      label: "Email",
      Icon: Mail,
      type: "email",
      placeholder: "jean@example.com",
      required: true,
    },
    {
      key: "phone",
      label: "Téléphone",
      Icon: Phone,
      type: "tel",
      placeholder: "+33 6 00 00 00 00",
      required: true,
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              Nouveau contact
            </p>
            <p className="text-xs text-gray-400">Créer un contact</p>
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
          <p className="text-xs text-gray-400">
            Un nom ainsi qu'un email ou un téléphone sont requis
            <span className="text-red-400"> *</span>
          </p>

          {fields.map(
            ({ key, label, Icon, type, placeholder, required }, i) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {label}
                  {required && <span className="text-red-400 ml-0.5">*</span>}
                </label>

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
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent placeholder:text-gray-300"
                  />
                </div>
              </div>
            ),
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors hover:cursor-pointer"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:cursor-pointer"
          >
            <Check size={14} />
            {saving ? "Création…" : "Créer le contact"}
          </button>
        </div>
      </div>
    </div>
  );
}
