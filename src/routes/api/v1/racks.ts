import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireFlockAuth } from "@/lib/api-auth";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { upsertOneRack } from "@/lib/queries";

const bodySchema = z.object({
  slug: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(40).optional(),
  clusters: z.array(z.string().trim().min(1).max(40)).min(2).max(4),
});

function rackBodyError(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) {
    return "Provide a valid rack body.";
  }
  if (issue.path[0] === "slug") {
    return "Rack slug must be 1–32 characters.";
  }
  if (issue.path[0] === "name") {
    return "Rack name must be 1–40 characters.";
  }
  if (issue.path[0] === "clusters" && issue.path.length > 1) {
    return "Roost names must be 1–40 characters.";
  }
  if (issue.path[0] === "clusters") {
    return "A rack pins 2–4 roosts.";
  }
  return "Provide an optional rack slug (1–32 characters), an optional rack name (1–40 characters), and 2–4 roost names (1–40 characters each).";
}

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
          return jsonError(400, rackBodyError(parsed.error), "invalid_body");
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
