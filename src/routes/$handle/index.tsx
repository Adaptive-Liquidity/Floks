import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { FlockPageView } from "@/components/flock-page";
import { RESERVED_HANDLES } from "@/lib/handles";
import { getAppOrigin } from "@/lib/origin.server";
import { getBirdsForFlock, getFlockByHandle, getLatestChirp } from "@/lib/queries";

const loadFlockPage = createServerFn({ method: "GET" })
  .validator((handle: string) => handle)
  .handler(async ({ data: handle }) => {
    if (RESERVED_HANDLES.has(handle)) return null;
    const flock = await getFlockByHandle(handle);
    if (!flock) return null;
    const [birds, latest] = await Promise.all([
      getBirdsForFlock(flock.id),
      getLatestChirp(flock.id),
    ]);
    return {
      flock,
      birds,
      latest,
      origin: getAppOrigin(),
    };
  });

export const Route = createFileRoute("/$handle/")({
  loader: async ({ params }) => {
    const data = await loadFlockPage({ data: params.handle });
    if (!data) throw notFound();
    return data;
  },
  component: FlockRoute,
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Flok" }] };
    const { flock, origin } = loaderData;
    const title = `${flock.title} · ${flock.handle}`;
    const description = flock.bio || `A flock of Grok Bots published on Flok.`;
    const image = `${origin}/${flock.handle}/opengraph-image`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
    };
  },
});

function FlockRoute() {
  const { flock, birds, latest, origin } = Route.useLoaderData();
  return (
    <FlockPageView
      flock={flock}
      birds={birds}
      latest={latest}
      pageUrl={`${origin}/${flock.handle}`}
    />
  );
}
