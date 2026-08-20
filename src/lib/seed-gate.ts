/** HTTP seed is never allowed in production, even if FLOK_ALLOW_SEED is set. */
export function seedHttpAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" && env.FLOK_ALLOW_SEED === "1";
}
