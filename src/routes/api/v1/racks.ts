import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireFlockAuth } from "@/lib/api-auth";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { upsertOneRack } from "@/lib/queries";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  clusters: z.array(z.string().trim().min(1).max(40)).min(2).max(4),
});

export const Route = createFileRoute("/api/v1/racks")({
  server: {
    handlers: {
      PUT: async ({ request }) => {
        const auth = await requireFlockAuth(request);
        if (!auth.ok) {
          logRequest("PUT", "/api/v1/racks", 401);
          return auth.response;
        }
        if (!auth.flock) {
          logRequest("PUT", "/api/v1/racks", 404);
          return jsonError(404, "Publish the crew before pinning a rack.", "flock_missing");
        }
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          logRequest("PUT", "/api/v1/racks", 400);
          return jsonError(400, "Expected JSON body.", "invalid_json");
        }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          logRequest("PUT", "/api/v1/racks", 400);
          return jsonError(400, "A rack pins 2–4 roosts.", "invalid_body");
        }
        const pinned = await upsertOneRack(auth.flock.id, parsed.data);
        if (!pinned.ok) {
          logRequest("PUT", "/api/v1/racks", 400);
          return jsonError(400, pinned.error, pinned.code);
        }
        logRequest("PUT", "/api/v1/racks", 200);
        return jsonOk({
          handle: auth.flock.handle,
          racks: pinned.racks.map((rack) => ({
            name: rack.name,
            slug: rack.slug,
            roosts: rack.roosts.map((roost) => ({ name: roost.name, slug: roost.slug })),
          })),
        });
      },
    },
  },
});
