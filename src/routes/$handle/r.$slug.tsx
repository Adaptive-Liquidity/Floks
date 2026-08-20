import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { RackPageView, type RackRoostView } from "@/components/rack-page";
import { RESERVED_HANDLES } from "@/lib/handles";
import {
  getBirdsForCluster,
  getFlockByHandle,
  getLatestChirpForCluster,
  getRackBySlug,
} from "@/lib/queries";

const loadRack = createServerFn({ method: "GET" })
  .validator((data: { handle: string; slug: string }) => data)
  .handler(async ({ data }) => {
    if (RESERVED_HANDLES.has(data.handle)) return null;
    const flock = await getFlockByHandle(data.handle);
    if (!flock) return null;
    const rack = await getRackBySlug(flock.id, data.slug);
    if (!rack) return null;
    const roosts: RackRoostView[] = await Promise.all(
      rack.roosts.map(async (cluster) => {
        const [birds, latest] = await Promise.all([
          getBirdsForCluster(cluster.id),
          getLatestChirpForCluster(cluster.id),
        ]);
        return { cluster, birds, latest };
      }),
    );
    return { flock, rack, roosts };
  });

export const Route = createFileRoute("/$handle/r/$slug")({
  loader: async ({ params }) => {
    const data = await loadRack({ data: { handle: params.handle, slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  component: RackRoute,
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Flok" }] };
    const { flock, rack } = loaderData;
    return {
      meta: [{ title: `${rack.name} · ${flock.handle}` }],
    };
  },
});

function RackRoute() {
  const { flock, rack, roosts } = Route.useLoaderData();
  return <RackPageView flock={flock} rack={rack} roosts={roosts} />;
}
