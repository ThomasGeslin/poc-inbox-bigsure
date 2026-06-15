function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "09:42", "Hier", "13/06" */
export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const msgDay = startOfDay(date);

  if (msgDay.getTime() === today.getTime()) {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (msgDay.getTime() === yesterday.getTime()) {
    return "Hier";
  }
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/** "AUJOURD'HUI", "HIER", "SAMEDI 13 JUIN" */
export function getDateLabel(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const msgDay = startOfDay(date);

  if (msgDay.getTime() === today.getTime()) return "AUJOURD'HUI";
  if (msgDay.getTime() === yesterday.getTime()) return "HIER";

  return date
    .toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toUpperCase();
}

/** "4 min 05s" */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} min ${String(s).padStart(2, "0")}s`;
}

/** "SM" from "Sophie Martin" */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
