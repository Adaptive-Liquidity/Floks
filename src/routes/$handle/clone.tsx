import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { CopyButton } from "@/components/copy-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buildClonePrompt, standingOrdersFor } from "@/lib/clone-pack";
import { getAppOrigin } from "@/lib/origin.server";
import { getBirdsForFlock, getFlockByHandle } from "@/lib/queries";

const loadClone = createServerFn({ method: "GET" })
  .validator((handle: string) => handle)
  .handler(async ({ data: handle }) => {
    const flock = await getFlockByHandle(handle);
    if (!flock) return null;
    const birds = await getBirdsForFlock(flock.id);
    const origin = getAppOrigin();
    const packBirds = birds.map((b) => ({
      name: b.name,
      role: b.role,
      standing_orders: standingOrdersFor(b.role),
    }));
    return {
      flock,
      birds: packBirds,
      prompt: buildClonePrompt({
        origin,
        sourceHandle: flock.handle,
        title: flock.title,
        birds: packBirds,
      }),
    };
  });

export const Route = createFileRoute("/$handle/clone")({
  loader: async ({ params }) => {
    const data = await loadClone({ data: params.handle });
    if (!data) throw notFound();
    return data;
  },
  component: ClonePage,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Clone ${loaderData.flock.title} · Flok`
          : "Clone · Flok",
      },
    ],
  }),
});

function ClonePage() {
  const { flock, birds, prompt } = Route.useLoaderData();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5">
      <SiteHeader />
      <main className="flex-1 pt-4">
        <p className="font-mono text-sm text-fg-muted">{flock.handle}</p>
        <h1 className="mt-2 text-4xl font-medium">Clone this flock</h1>
        <p className="mt-3 text-fg-muted">
          A paste prompt that stands up a similar crew on your Grok Bot. It does
          not copy logins, files, inboxes, or credentials.
        </p>

        <section className="mt-8">
          <h2 className="font-sans text-sm font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Roster
          </h2>
          <ul className="mt-3 space-y-3">
            {birds.map((bird) => (
              <li key={bird.name} className="rounded-xl bg-bg-elevated p-4">
                <p className="font-medium">{bird.name}</p>
                <p className="text-sm text-fg-muted">{bird.role}</p>
                <p className="mt-2 text-sm text-fg-subtle">
                  {bird.standing_orders}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-sans text-sm font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Paste this
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-bg-elevated p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {prompt}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton value={prompt} label="Copy clone prompt" />
            <Link
              to="/join"
              className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-fg no-underline"
            >
              Then pick your handle
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
