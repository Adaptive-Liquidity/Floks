import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { resetSeed } from "@/lib/seed";
import { seedHttpAllowed } from "@/lib/seed-gate";

export const Route = createFileRoute("/api/v1/seed")({
  server: {
    handlers: {
      POST: async () => {
        if (!seedHttpAllowed()) {
          logRequest("POST", "/api/v1/seed", 403);
          return jsonError(403, "Seed is disabled.", "seed_disabled");
        }
        await resetSeed();
        logRequest("POST", "/api/v1/seed", 200);
        return jsonOk({ ok: true });
      },
    },
  },
});
