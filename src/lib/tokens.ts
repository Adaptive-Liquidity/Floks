import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const globalRef = globalThis as typeof globalThis & { __flokTokenSecret__?: string };

function tokenSecret(): string {
  const fromEnv = typeof process !== "undefined" ? process.env.FLOK_TOKEN_SECRET : undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  globalRef.__flokTokenSecret__ ??= randomBytes(32).toString("hex");
  return globalRef.__flokTokenSecret__;
}

export function generateFlockToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256")
    .update(token + tokenSecret())
    .digest("hex");
}

export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const CROCKFORD = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateClaimCode(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += CROCKFORD[bytes[i]! % CROCKFORD.length];
  }
  return out;
}
