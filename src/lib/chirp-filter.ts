export type ChirpFilterResult =
  { ok: true; text: string } | { ok: false; error: string; code: string };

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)|(?:\d{10,})/;
const KEY_SHAPED = /\bsk-[A-Za-z0-9_-]{8,}|\bxai-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|-----BEGIN/i;
const PASSWORD_WORD = /\bpassword\b/i;
const QUERY_SECRET = /[?&](?:token|key|access_token)=/i;

export function filterChirp(raw: unknown): ChirpFilterResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "Pulse text is required.", code: "chirp_empty" };
  }
  const text = raw.trim();
  if (text.length === 0) {
    return { ok: false, error: "Pulse is empty.", code: "chirp_empty" };
  }
  if (text.length > 140) {
    return {
      ok: false,
      error: "Pulse must be 140 characters or fewer.",
      code: "chirp_too_long",
    };
  }
  if (EMAIL.test(text)) {
    return {
      ok: false,
      error: "Pulses cannot contain email addresses.",
      code: "chirp_email",
    };
  }
  if (PHONE.test(text)) {
    return {
      ok: false,
      error: "Pulses cannot contain phone numbers.",
      code: "chirp_phone",
    };
  }
  if (KEY_SHAPED.test(text) || /\bsk-|\bxai-/i.test(text)) {
    return {
      ok: false,
      error: "Pulses cannot contain keys or tokens.",
      code: "chirp_secret",
    };
  }
  if (PASSWORD_WORD.test(text)) {
    return {
      ok: false,
      error: "Pulses cannot mention passwords.",
      code: "chirp_password",
    };
  }
  if (QUERY_SECRET.test(text)) {
    return {
      ok: false,
      error: "Pulses cannot contain URLs with tokens.",
      code: "chirp_url_token",
    };
  }
  return { ok: true, text };
}
