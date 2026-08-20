import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireFlockAuth } from "@/lib/api-auth";
import { filterChirp } from "@/lib/chirp-filter";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { findBirdInFlock, insertChirp, recentChirpForBird } from "@/lib/queries";

const bodySchema = z.object({
  bird: z.string().trim().min(1).max(32),
  text: z.string(),
  source: z.enum(["heartbeat", "manual"]).optional(),
});

export const Route = createFileRoute("/api/v1/chirps")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireFlockAuth(request);
        if (!auth.ok) {
          logRequest("POST", "/api/v1/chirps", 401);
          return auth.response;
        }
        if (!auth.flock) {
          logRequest("POST", "/api/v1/chirps", 400);
          return jsonError(400, "Publish the crew roster before pulsing.", "flock_missing");
        }
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          logRequest("POST", "/api/v1/chirps", 400);
          return jsonError(400, "Expected JSON body.", "invalid_json");
        }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          logRequest("POST", "/api/v1/chirps", 400);
          return jsonError(400, "Need a node name and pulse text.", "invalid_body");
        }
        const filtered = filterChirp(parsed.data.text);
        if (!filtered.ok) {
          logRequest("POST", "/api/v1/chirps", 400);
          return jsonError(400, filtered.error, filtered.code);
        }
        const bird = await findBirdInFlock(auth.flock.id, parsed.data.bird);
        if (!bird) {
          logRequest("POST", "/api/v1/chirps", 404);
          return jsonError(404, "That node is not in this crew.", "bird_missing");
        }
        const limited = await recentChirpForBird(bird.id, 10 * 60 * 1000);
        if (limited) {
          logRequest("POST", "/api/v1/chirps", 429);
          return jsonError(429, "One pulse per node every 10 minutes.", "chirp_rate");
        }
        const chirp = await insertChirp({
          bird,
          text: filtered.text,
          source: parsed.data.source ?? "heartbeat",
        });
        logRequest("POST", "/api/v1/chirps", 200);
        return jsonOk({
          id: chirp.id,
          bird: bird.name,
          text: chirp.text,
          created_at: chirp.created_at,
        });
      },
    },
  },
});
