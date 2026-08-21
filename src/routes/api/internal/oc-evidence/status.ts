import { createFileRoute } from "@tanstack/react-router";
import { isOcDrainAuthorized } from "@/lib/oc-egress-auth.server";
import { readOcOutboxStatus } from "@/lib/oc-egress.server";
import { jsonError, jsonOk, logRequest } from "@/lib/http";

const path = "/api/internal/oc-evidence/status";

export async function handleOcEvidenceStatus(request: Request): Promise<Response> {
  if (!isOcDrainAuthorized(request)) {
    logRequest("GET", path, 401);
    return jsonError(401, "Unauthorized.", "unauthorized");
  }
  const outbox = await readOcOutboxStatus();
  logRequest("GET", path, 200);
  return jsonOk({ ok: true, outbox });
}

export const Route = createFileRoute("/api/internal/oc-evidence/status")({
  server: {
    handlers: {
      GET: async ({ request }) => handleOcEvidenceStatus(request),
    },
  },
});
