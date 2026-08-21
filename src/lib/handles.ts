const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_HANDLES = new Set([
  "join",
  "sky",
  "skill",
  "admin",
  "api",
  "www",
  "grok",
  "bot",
  "flok",
  "clone",
  "card",
  "contracts",
  "health",
  "login",
  "auth",
  "robots",
  "favicon",
]);

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateHandle(
  raw: string,
): { ok: true; handle: string } | { ok: false; error: string; code: string } {
  const handle = normalizeHandle(raw);
  if (handle.length < 3 || handle.length > 20) {
    return {
      ok: false,
      error: "Handle must be 3–20 characters.",
      code: "handle_length",
    };
  }
  if (!HANDLE_RE.test(handle)) {
    return {
      ok: false,
      error: "Use lowercase letters, numbers, and single hyphens between words.",
      code: "handle_format",
    };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return {
      ok: false,
      error: "That handle is reserved.",
      code: "handle_reserved",
    };
  }
  return { ok: true, handle };
}
