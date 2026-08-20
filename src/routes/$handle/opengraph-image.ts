import { createFileRoute } from "@tanstack/react-router";
import { jsonError, logRequest } from "@/lib/http";
import { getAppOrigin, publicHost } from "@/lib/origin.server";
import { getClusterCards, getFlockByHandle } from "@/lib/queries";
import { renderFlockCardPng } from "@/lib/render-og.server";

export const Route = createFileRoute("/$handle/opengraph-image")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const flock = await getFlockByHandle(params.handle);
        if (!flock) {
          logRequest("GET", "/$handle/opengraph-image", 404);
          return jsonError(404, "No crew with that handle.", "flock_missing");
        }
        const clusters = await getClusterCards(flock.id);
        const nodeCount = clusters.reduce((n, c) => n + c.node_count, 0);
        const host = publicHost(getAppOrigin(request));
        try {
          const png = await renderFlockCardPng({
            flock,
            clusters: clusters.map((c) => ({ name: c.name, faces: c.faces })),
            nodeCount,
            host,
          });
          logRequest("GET", "/$handle/opengraph-image", 200);
          return new Response(Buffer.from(png), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=60",
            },
          });
        } catch (err) {
          console.error("[flok] og render failed", err instanceof Error ? err.message : "error");
          logRequest("GET", "/$handle/opengraph-image", 500);
          return jsonError(500, "Could not render the card.", "og_failed");
        }
      },
    },
  },
});
