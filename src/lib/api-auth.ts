import { bearerToken, jsonError } from "@/lib/http";
import { resolveAuthToken } from "@/lib/queries";
import { hashToken } from "@/lib/tokens";
import type { Flock } from "@/lib/types";

export async function requireFlockAuth(
  request: Request,
): Promise<
  | { ok: true; flock: Flock | null; handle: string; tokenHash: string }
  | { ok: false; response: Response }
> {
  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: jsonError(401, "Missing or invalid bearer token.", "unauthorized"),
    };
  }
  const auth = await resolveAuthToken(token);
  if (!auth) {
    return {
      ok: false,
      response: jsonError(
        401,
        "Unknown flock token. Ask the human to rejoin. Do not invent a new crew.",
        "unauthorized",
      ),
    };
  }
  return { ok: true, flock: auth.flock, handle: auth.handle, tokenHash: hashToken(token) };
}
