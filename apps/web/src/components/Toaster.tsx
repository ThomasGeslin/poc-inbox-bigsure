import { useCallback, useRef, useState, type ReactNode } from "react";
import { CheckCircle, X, XCircle } from "lucide-react";
import { ToastContext, type ToastType } from "./ToastContext.ts";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  /** Dismiss a toast by its ID */
  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** Show a toast message */
  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++counterRef.current;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto min-w-64 max-w-sm animate-fade-in ${
              t.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle size={16} className="text-green-500 shrink-0" />
            ) : (
              <XCircle size={16} className="text-red-500 shrink-0" />
            )}

            <span className="flex-1">{t.message}</span>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Fermer"
              className="ml-2 shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
