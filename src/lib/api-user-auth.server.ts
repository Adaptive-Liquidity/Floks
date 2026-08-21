import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";
import { bearerToken, jsonError } from "@/lib/http";

export function hasUnverifiableCookieWrite(request: Request): boolean {
  return (
    request.method !== "GET" &&
    !request.headers.get("sec-fetch-site") &&
    Boolean(request.headers.get("cookie")) &&
    !bearerToken(request) &&
    request.headers.get("origin") !== new URL(request.url).origin
  );
}

export async function requireApiUser(
  request: Request,
): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  try {
    if (hasUnverifiableCookieWrite(request)) {
      return {
        ok: false,
        response: jsonError(403, "Request origin could not be verified.", "forbidden"),
      };
    }
    assertSameSiteRequest();
    const userId = await requireUserId(bearerToken(request) ?? undefined);
    return { ok: true, userId };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        ok: false,
        response: jsonError(401, "Sign in to manage Outcome Contracts.", "unauthorized"),
      };
    }
    if (error instanceof CrossSiteRequestError) {
      return {
        ok: false,
        response: jsonError(403, "Cross-site request blocked.", "forbidden"),
      };
    }
    throw error;
  }
}
