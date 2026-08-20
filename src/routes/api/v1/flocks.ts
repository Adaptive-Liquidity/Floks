import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireFlockAuth } from "@/lib/api-auth";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { upsertFlockRoster } from "@/lib/queries";

const birdSchema = z.object({
  name: z.string().trim().min(1).max(32),
  role: z.string().trim().min(1).max(60),
  grok_bot_label: z.string().trim().max(32).optional(),
});

const bodySchema = z.object({
  title: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(200).optional(),
  owner_hint: z.string().trim().max(80).optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  birds: z.array(birdSchema).min(1).max(20),
});

export const Route = createFileRoute("/api/v1/flocks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireFlockAuth(request);
        if (!auth.ok) {
          logRequest("POST", "/api/v1/flocks", 401);
          return auth.response;
        }
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          logRequest("POST", "/api/v1/flocks", 400);
          return jsonError(400, "Expected JSON body.", "invalid_json");
        }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          logRequest("POST", "/api/v1/flocks", 400);
          return jsonError(
            400,
            "Need a title and 1–20 nodes with names and roles.",
            "invalid_body",
          );
        }
        const names = parsed.data.birds.map((b) => b.name.toLowerCase());
        if (new Set(names).size !== names.length) {
          logRequest("POST", "/api/v1/flocks", 400);
          return jsonError(400, "Node names must be unique in a crew.", "duplicate_bird");
        }
        const { flock, birds } = await upsertFlockRoster({
          handle: auth.handle,
          tokenHash: auth.tokenHash,
          title: parsed.data.title,
          bio: parsed.data.bio ?? "",
          ownerHint: parsed.data.owner_hint,
          visibility: parsed.data.visibility,
          birds: parsed.data.birds,
        });
        logRequest("POST", "/api/v1/flocks", 200);
        return jsonOk({
          handle: flock.handle,
          title: flock.title,
          bio: flock.bio,
          birds: birds.map((b) => ({
            id: b.id,
            name: b.name,
            role: b.role,
            state: b.state,
            color: b.color,
          })),
        });
      },
    },
  },
});
