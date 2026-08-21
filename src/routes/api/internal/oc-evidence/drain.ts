import { createFileRoute } from "@tanstack/react-router";
import {
  drainOcEvidenceOutbox,
  readOcEgressConfig,
  sweepExpiredOutcomeContracts,
} from "@/lib/oc-egress.server";
import { isOcDrainAuthorized } from "@/lib/oc-egress-auth.server";
import { jsonError, jsonOk, logRequest } from "@/lib/http";

const path = "/api/internal/oc-evidence/drain";

export async function handleOcEvidenceDrain(request: Request): Promise<Response> {
  if (!isOcDrainAuthorized(request)) {
    logRequest("POST", path, 401);
    return jsonError(401, "Unauthorized.", "unauthorized");
  }
  const sweep = await sweepExpiredOutcomeContracts();
  if (!readOcEgressConfig()) {
    logRequest("POST", path, 503);
    return jsonError(503, "SPX staging egress is disabled.", "staging_egress_disabled");
  }

  // Phase B is explicitly staging-only and does not depend on decoderLive.
  // Gate 2 owns the later decoder flip; waiting for it here would deadlock the staging soak.
  const drain = await drainOcEvidenceOutbox();
  logRequest("POST", path, 200);
  return jsonOk({ ok: true, sweep, drain });
}

export const Route = createFileRoute("/api/internal/oc-evidence/drain")({
  server: {
    handlers: {
      POST: async ({ request }) => handleOcEvidenceDrain(request),
    },
  },
});
