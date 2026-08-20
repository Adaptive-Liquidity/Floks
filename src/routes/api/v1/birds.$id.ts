import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireFlockAuth } from "@/lib/api-auth";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { getBirdById, updateBirdState } from "@/lib/queries";

const bodySchema = z.object({
  state: z.enum(["working", "idle", "offline"]),
});

export const Route = createFileRoute("/api/v1/birds/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const auth = await requireFlockAuth(request);
        if (!auth.ok) {
          logRequest("PUT", "/api/v1/birds/:id", 401);
          return auth.response;
        }
        if (!auth.flock) {
          logRequest("PUT", "/api/v1/birds/:id", 404);
          return jsonError(404, "That node is not in this crew.", "bird_missing");
        }
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          logRequest("PUT", "/api/v1/birds/:id", 400);
          return jsonError(400, "Expected JSON body.", "invalid_json");
        }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          logRequest("PUT", "/api/v1/birds/:id", 400);
          return jsonError(400, "State must be working, idle, or offline.", "invalid_body");
        }
        const existing = await getBirdById(params.id);
        if (!existing || existing.flock_id !== auth.flock.id) {
          logRequest("PUT", "/api/v1/birds/:id", 404);
          return jsonError(404, "That node is not in this crew.", "bird_missing");
        }
        const bird = await updateBirdState(auth.flock.id, params.id, parsed.data.state);
        if (!bird) {
          logRequest("PUT", "/api/v1/birds/:id", 404);
          return jsonError(404, "That node is not in this crew.", "bird_missing");
        }
        logRequest("PUT", "/api/v1/birds/:id", 200);
        return jsonOk({ id: bird.id, name: bird.name, state: bird.state });
      },
    },
  },
});
