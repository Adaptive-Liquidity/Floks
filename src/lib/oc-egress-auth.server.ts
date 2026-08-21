import { timingSafeEqual } from "node:crypto";
import { bearerToken } from "./http.ts";

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isOcDrainAuthorized(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const expected = env.FLOK_OC_DRAIN_SECRET?.trim();
  const provided = bearerToken(request);
  return Boolean(expected && provided && safeEqual(provided, expected));
}
