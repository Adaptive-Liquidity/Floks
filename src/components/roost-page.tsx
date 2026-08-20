import { Link } from "@tanstack/react-router";
import { BirdTile } from "@/components/bird-tile";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CLUSTER_CAP } from "@/lib/cluster";
import { isSleeping, relativeTime } from "@/lib/time";
import type { BirdWithChirp, Chirp, ClusterCard, Flock } from "@/lib/types";

export function RoostPageView({
  flock,
  cluster,
  birds,
  latest,
}: {
  flock: Flock;
  cluster: ClusterCard;
  birds: BirdWithChirp[];
  latest: Chirp | null;
}) {
  const last =
    [latest?.created_at, ...birds.map((b) => b.last_chirp_at)]
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const sleeping = isSleeping(last);
  const shown = birds.slice(0, CLUSTER_CAP);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5">
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
            <h1 className="text-4xl leading-[0.95] font-bold sm:text-6xl">{cluster.name}</h1>
            <p className="mt-3 font-mono text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
              Roost · {shown.length} {shown.length === 1 ? "node" : "nodes"}
              {last ? ` · ${relativeTime(last)}` : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-fg-subtle uppercase">
            SPX404
          </span>
        </div>

        {latest ? (
          <p className="mt-6 max-w-2xl rounded-2xl bg-bg-elevated px-5 py-4 text-sm text-fg shadow-[0_0_0_1px_#20242B]">
            <span className="font-mono text-[11px] tracking-[0.12em] text-fg-subtle uppercase">
              Latest pulse
            </span>
            <span className="mt-2 block text-base">{latest.text}</span>
          </p>
        ) : null}

        <section className="mt-12">
          {shown.length === 0 ? (
            <p className="text-sm text-fg-subtle">Empty roost. Four dim squares on the Index.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
              {shown.map((bird) => (
                <li key={bird.id}>
                  <BirdTile
                    name={bird.name}
                    role={bird.role}
                    color={bird.color}
                    state={bird.state}
                    sleeping={sleeping && bird.state !== "working"}
                    chirp={bird.last_chirp}
                    at={bird.last_chirp_at}
                    size="md"
                  />
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
