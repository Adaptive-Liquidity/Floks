import { getRequest } from "@tanstack/react-start/server";

export function getAppOrigin(request?: Request): string {
  const envHost = typeof process !== "undefined" ? process.env.VITE_PUBLIC_HOSTNAME : undefined;
  if (envHost && envHost.trim()) return `https://${envHost.trim()}`;

  const explicit = typeof process !== "undefined" ? process.env.FLOK_APP_URL : undefined;
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/$/, "");

  const req = request ?? safeRequest();
  if (req) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    if (host) {
      const proto =
        req.headers.get("x-forwarded-proto") ??
        (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`;
    }
  }
  return "http://127.0.0.1:8080";
}

function safeRequest(): Request | null {
  try {
    return getRequest();
  } catch {
    return null;
  }
}

export function publicHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return "flok.so";
  }
}
