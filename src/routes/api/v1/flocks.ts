import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { planClusters, slugifyCluster } from "@/lib/cluster";
import { requireFlockAuth } from "@/lib/api-auth";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { planRacks } from "@/lib/rack";
import { upsertFlockRacks, upsertFlockRoster } from "@/lib/queries";

const birdSchema = z.object({
  name: z.string().trim().min(1).max(32),
  role: z.string().trim().min(1).max(60),
  grok_bot_label: z.string().trim().max(32).optional(),
  cluster: z.string().trim().max(40).optional(),
});

const rackSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  clusters: z.array(z.string().trim().min(1).max(40)).min(2).max(4),
});

const bodySchema = z.object({
  title: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(200).optional(),
  owner_hint: z.string().trim().max(80).optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
  birds: z.array(birdSchema).min(1).max(50),
  racks: z.array(rackSchema).max(8).optional(),
});

function resolvePlannedCluster(
  clusters: ReturnType<typeof planClusters>,
  label: string,
): (typeof clusters)[number] | undefined {
  const key = label.trim().toLowerCase();
  const slug = slugifyCluster(label);
  return clusters.find((cluster) => {
    return cluster.slug === key || cluster.slug === slug || cluster.name.toLowerCase() === key;
  });
}

function validateIncomingRacks(input: z.infer<typeof bodySchema>) {
  if (!input.racks) return { ok: true } as const;
  const planned = planRacks(input.racks);
  if (!planned.ok) return planned;

  const clusters = planClusters(
    input.birds.map((bird) => ({ name: bird.name, cluster: bird.cluster })),
  );
  for (const rack of planned.plans) {
    const seen = new Set<string>();
    for (const label of rack.clusters) {
      const found = resolvePlannedCluster(clusters, label);
      if (!found) {
        return {
          ok: false,
          error: `Unknown roost "${label}". Pin clusters that already exist.`,
          code: "cluster_missing",
        } as const;
      }
      if (seen.has(found.slug)) {
        return {
          ok: false,
          error: "A rack cannot pin the same roost twice.",
          code: "duplicate_roost",
        } as const;
      }
      seen.add(found.slug);
    }
  }
  return { ok: true } as const;
}

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
            "Need a title and 1–50 nodes with names and roles.",
            "invalid_body",
          );
        }
        const names = parsed.data.birds.map((b) => b.name.toLowerCase());
        if (new Set(names).size !== names.length) {
          logRequest("POST", "/api/v1/flocks", 400);
          return jsonError(400, "Node names must be unique in a crew.", "duplicate_bird");
        }
        const rackCheck = validateIncomingRacks(parsed.data);
        if (!rackCheck.ok) {
          logRequest("POST", "/api/v1/flocks", 400);
          return jsonError(400, rackCheck.error, rackCheck.code);
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
        let racks: { name: string; slug: string; roosts: { name: string; slug: string }[] }[] = [];
        if (parsed.data.racks) {
          const pinned = await upsertFlockRacks(flock.id, parsed.data.racks);
          if (!pinned.ok) {
            logRequest("POST", "/api/v1/flocks", 400);
            return jsonError(400, pinned.error, pinned.code);
          }
          racks = pinned.racks.map((rack) => ({
            name: rack.name,
            slug: rack.slug,
            roosts: rack.roosts.map((roost) => ({ name: roost.name, slug: roost.slug })),
          }));
        }
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
          racks,
        });
      },
    },
  },
});
