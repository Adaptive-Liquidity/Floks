import { createFileRoute } from "@tanstack/react-router";
import { jsonOk, logRequest } from "@/lib/http";
import { resetSeed } from "@/lib/seed";

export const Route = createFileRoute("/api/v1/seed")({
  server: {
    handlers: {
      POST: async () => {
        await resetSeed();
        logRequest("POST", "/api/v1/seed", 200);
        return jsonOk({ ok: true });
      },
    },
  },
});
