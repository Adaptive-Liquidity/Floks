import { Link } from "@tanstack/react-router";
import { BirdTile } from "@/components/bird-tile";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CLUSTER_CAP } from "@/lib/cluster";
import { isLiveNode } from "@/lib/node-state";
import { isSleeping, relativeTime } from "@/lib/time";
import type { BirdWithChirp, Chirp, ClusterCard, Flock, RackCard } from "@/lib/types";

export type RackRoostView = {
  cluster: ClusterCard;
  birds: BirdWithChirp[];
  latest: Chirp | null;
};

export function RackPageView({
  flock,
  rack,
  roosts,
}: {
  flock: Flock;
  rack: RackCard;
  roosts: RackRoostView[];
}) {
  const last =
    roosts
      .flatMap((roost) => [roost.latest?.created_at, roost.cluster.last_chirp_at])
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const nodeCount = roosts.reduce((n, roost) => n + roost.birds.length, 0);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5">
      <SiteHeader />
      <main className="flex-1 pt-4">
        <Link
          to="/$handle"
          params={{ handle: flock.handle }}
          className="font-mono text-[11px] tracking-[0.14em] text-fg-subtle uppercase no-underline hover:text-fg-muted"
        >
          @{flock.handle} · Index
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl leading-[0.95] font-bold sm:text-6xl">{rack.name}</h1>
            <p className="mt-3 font-mono text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
              Rack · {roosts.length} {roosts.length === 1 ? "roost" : "roosts"} · {nodeCount}{" "}
              {nodeCount === 1 ? "node" : "nodes"}
              {last ? ` · ${relativeTime(last)}` : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-fg-subtle uppercase">
            SPX404
          </span>
        </div>

        <section className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
          {roosts.map((roost) => {
            const sleeping = isSleeping(roost.cluster.last_chirp_at);
            const shown = roost.birds.slice(0, CLUSTER_CAP);
            return (
              <article key={roost.cluster.id} className="min-w-0">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <Link
                      to="/$handle/c/$slug"
                      params={{ handle: flock.handle, slug: roost.cluster.slug }}
                      className="font-display text-2xl font-semibold tracking-[-0.04em] text-fg no-underline hover:text-fg-muted"
                    >
                      {roost.cluster.name}
                    </Link>
                    <p className="mt-1 font-mono text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                      Roost · {shown.length} {shown.length === 1 ? "node" : "nodes"}
                    </p>
                  </div>
                </div>
                {roost.latest ? (
                  <p className="mt-4 rounded-2xl bg-bg-elevated px-4 py-3 text-sm text-fg shadow-[0_0_0_1px_#20242B]">
                    <span className="font-mono text-[11px] tracking-[0.12em] text-fg-subtle uppercase">
                      Latest pulse
                    </span>
                    <span className="mt-1.5 line-clamp-2 block">{roost.latest.text}</span>
                  </p>
                ) : null}
                {shown.length === 0 ? (
                  <p className="mt-6 text-sm text-fg-subtle">Empty roost.</p>
                ) : (
                  <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6">
                    {shown.map((bird) => (
                      <li key={bird.id}>
                        <BirdTile
                          name={bird.name}
                          role={bird.role}
                          color={bird.color}
                          state={bird.state}
                          sleeping={sleeping && !isLiveNode(bird.state)}
                          chirp={bird.last_chirp}
                          at={bird.last_chirp_at}
                          size="sm"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
