import { createFileRoute } from "@tanstack/react-router";
import { buildClonePrompt, standingOrdersFor } from "@/lib/clone-pack";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { getAppOrigin } from "@/lib/origin.server";
import { getBirdsForFlock, getFlockByHandle } from "@/lib/queries";

export const Route = createFileRoute("/api/v1/clone/$handle")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const flock = await getFlockByHandle(params.handle);
        if (!flock) {
          logRequest("GET", "/api/v1/clone/:handle", 404);
          return jsonError(404, "No crew with that handle.", "flock_missing");
        }
        const birds = await getBirdsForFlock(flock.id);
        const packBirds = birds.map((b) => ({
          name: b.name,
          role: b.role,
          standing_orders: standingOrdersFor(b.role),
        }));
        const origin = getAppOrigin(request);
        const prompt = buildClonePrompt({
          origin,
          sourceHandle: flock.handle,
          title: flock.title,
          birds: packBirds,
        });
        logRequest("GET", "/api/v1/clone/:handle", 200);
        return jsonOk({
          handle: flock.handle,
          title: flock.title,
          bio: flock.bio,
          birds: packBirds,
          prompt,
        });
      },
    },
  },
});
