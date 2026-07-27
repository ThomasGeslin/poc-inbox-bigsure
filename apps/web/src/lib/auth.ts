const STORAGE_KEY = "poc-inbox-access-password";

/**
 * Shared access password, kept in localStorage so a refresh does not prompt
 * again. This is a team-wide secret, not a per-user credential: it only gates
 * access to the POC, and the API is the component that actually verifies it.
 */
export function getAccessPassword(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setAccessPassword(password: string): void {
  localStorage.setItem(STORAGE_KEY, password);
}

export function clearAccessPassword(): void {
  localStorage.removeItem(STORAGE_KEY);
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Registered by the password gate so that a 401 raised by any API call — the
 * password was changed server-side, for instance — brings the prompt back
 * instead of leaving the UI stuck on failing requests.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  clearAccessPassword();
  unauthorizedHandler?.();
}
