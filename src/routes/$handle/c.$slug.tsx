import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { RoostPageView } from "@/components/roost-page";
import { RESERVED_HANDLES } from "@/lib/handles";
import {
  getBirdsForCluster,
  getClusterBySlug,
  getFlockByHandle,
  getLatestChirpForCluster,
} from "@/lib/queries";

const loadRoost = createServerFn({ method: "GET" })
  .validator((data: { handle: string; slug: string }) => data)
  .handler(async ({ data }) => {
    if (RESERVED_HANDLES.has(data.handle)) return null;
    const flock = await getFlockByHandle(data.handle);
    if (!flock) return null;
    const cluster = await getClusterBySlug(flock.id, data.slug);
    if (!cluster) return null;
    const [birds, latest] = await Promise.all([
      getBirdsForCluster(cluster.id),
      getLatestChirpForCluster(cluster.id),
    ]);
    return { flock, cluster, birds, latest };
  });

export const Route = createFileRoute("/$handle/c/$slug")({
  loader: async ({ params }) => {
    const data = await loadRoost({ data: { handle: params.handle, slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  component: RoostRoute,
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Flok" }] };
    const { flock, cluster } = loaderData;
    return {
      meta: [{ title: `${cluster.name} · ${flock.handle}` }],
    };
  },
});

function RoostRoute() {
  const { flock, cluster, birds, latest } = Route.useLoaderData();
  return <RoostPageView flock={flock} cluster={cluster} birds={birds} latest={latest} />;
}
