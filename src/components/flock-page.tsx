import { Link } from "@tanstack/react-router";
import { ClusterTile } from "@/components/cluster-tile";
import { CopyButton } from "@/components/copy-button";
import { RackTile } from "@/components/rack-tile";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isSleeping } from "@/lib/time";
import type { Chirp, ClusterCard, Flock, RackCard } from "@/lib/types";

export function FlockPageView({
  flock,
  clusters,
  racks,
  latest,
  nodeCount,
  pageUrl,
}: {
  flock: Flock;
  clusters: ClusterCard[];
  racks: RackCard[];
  latest: Chirp | null;
  nodeCount: number;
  pageUrl: string;
}) {
  const last =
    [latest?.created_at, ...clusters.map((c) => c.last_chirp_at)]
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const sleeping = isSleeping(last);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5">
      <SiteHeader />
      <main className="flex-1 pt-4">
        <p className="font-mono text-sm text-fg-muted">@{flock.handle}</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl leading-[0.95] font-bold sm:text-6xl">{flock.title}</h1>
            {flock.bio ? (
              <p className="mt-4 max-w-xl text-base text-fg-muted">{flock.bio}</p>
            ) : null}
          </div>
          {sleeping ? (
            <span className="rounded-full border border-border px-3 py-1 font-mono text-[11px] tracking-[0.14em] text-sleep uppercase">
              Sleeping
            </span>
          ) : (
            <span className="rounded-full bg-accent/12 px-3 py-1 font-mono text-[11px] tracking-[0.14em] text-working uppercase">
              Live
            </span>
          )}
        </div>

        {flock.is_seed ? (
          <p className="mt-4 text-sm text-fg-subtle">Demo crew · not a live company</p>
        ) : null}

        {latest ? (
          <p className="mt-6 max-w-2xl rounded-2xl bg-bg-elevated px-5 py-4 text-sm text-fg shadow-[0_0_0_1px_#20242B]">
            <span className="font-mono text-[11px] tracking-[0.12em] text-fg-subtle uppercase">
              Latest pulse
            </span>
            <span className="mt-2 block text-base">{latest.text}</span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <CopyButton value={pageUrl} label="Copy page URL" />
          <Link
            to="/$handle/clone"
            params={{ handle: flock.handle }}
            className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-fg no-underline hover:border-border-strong"
          >
            Clone this crew
          </Link>
        </div>

        {racks.length > 0 ? (
          <section className="mt-12">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-mono text-[11px] font-medium tracking-[0.18em] text-fg-subtle uppercase">
                Racks
              </h2>
              <p className="font-mono text-[11px] tracking-[0.06em] text-fg-subtle">
                {racks.length} {racks.length === 1 ? "rack" : "racks"}
              </p>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {racks.map((rack) => (
                <li key={rack.id}>
                  <RackTile handle={flock.handle} rack={rack} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-mono text-[11px] font-medium tracking-[0.18em] text-fg-subtle uppercase">
              Clusters
            </h2>
            <p className="font-mono text-[11px] tracking-[0.06em] text-fg-subtle">
              {clusters.length} {clusters.length === 1 ? "cluster" : "clusters"} · {nodeCount}{" "}
              {nodeCount === 1 ? "node" : "nodes"}
            </p>
          </div>
          {clusters.length === 0 ? (
            <p className="mt-6 text-sm text-fg-subtle">No clusters yet.</p>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {clusters.map((cluster) => (
                <li key={cluster.id}>
                  <ClusterTile handle={flock.handle} cluster={cluster} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
