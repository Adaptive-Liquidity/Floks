export function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toISOString();
  }
  return String(value);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "Hasn’t checked in";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Hasn’t checked in";
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 14) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export function isSleeping(lastChirpAt: string | null | undefined): boolean {
  if (!lastChirpAt) return true;
  const then = new Date(lastChirpAt).getTime();
  if (Number.isNaN(then)) return true;
  return Date.now() - then > 24 * 60 * 60 * 1000;
}
