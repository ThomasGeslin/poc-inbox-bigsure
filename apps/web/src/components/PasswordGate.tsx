import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Lock, LoaderCircle } from "lucide-react";
import { checkPassword } from "../lib/api";
import {
  clearAccessPassword,
  getAccessPassword,
  setAccessPassword,
  setUnauthorizedHandler,
} from "../lib/auth";

interface PasswordGateProps {
  children: ReactNode;
}

/**
 * Gates the whole app behind the shared team password. The API is the authority:
 * this only asks, stores the answer, and lets the app through once /auth/check
 * accepts it.
 */
export default function PasswordGate({ children }: PasswordGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  // Only worth a verification pass when there is something stored to verify;
  // deriving it here avoids a synchronous state update on mount.
  const [verifying, setVerifying] = useState(
    () => getAccessPassword() !== null,
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  /** Re-check a stored password on mount — it may have been rotated since. */
  useEffect(() => {
    const stored = getAccessPassword();

    if (!stored) return;

    let active = true;

    checkPassword(stored)
      .then((valid) => {
        if (!active) return;
        if (!valid) clearAccessPassword();
        setUnlocked(valid);
      })
      .catch(() => {
        // API unreachable: fall through to the prompt rather than a blank page.
      })
      .finally(() => {
        if (active) setVerifying(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /** A 401 raised by any later call brings the prompt back. */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUnlocked(false);
      setPassword("");
      setError("Accès expiré. Saisissez à nouveau le mot de passe.");
    });
  }, []);

  /** Focus the field as soon as the prompt is shown */
  useEffect(() => {
    if (!verifying && !unlocked) inputRef.current?.focus();
  }, [verifying, unlocked]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!password.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      if (!(await checkPassword(password))) {
        setError("Mot de passe incorrect.");
        return;
      }

      setAccessPassword(password);
      setUnlocked(true);
    } catch {
      setError("API injoignable. Vérifiez qu'elle est bien démarrée.");
    } finally {
      setSubmitting(false);
    }
  }

  // Render nothing while re-checking a stored password: this is a single fast
  // request, and flashing the prompt at every reload would be worse.
  if (verifying) return null;

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-5 w-5 text-slate-600" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Inbox</h1>
            <p className="mt-1 text-sm text-slate-500">
              Accès protégé. Saisissez le mot de passe de l'équipe.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!password.trim() || submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {submitting ? "Vérification…" : "Entrer"}
        </button>
      </form>
    </div>
  );
}
