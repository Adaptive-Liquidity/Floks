import { Link } from "@tanstack/react-router";
import { BirdFace } from "@/components/bird-face";
import { isLiveNode } from "@/lib/node-state";
import { isSleeping, relativeTime } from "@/lib/time";
import type { ClusterCard, ClusterFace } from "@/lib/types";

const STUB: ClusterFace = { name: "", color: "#16191F", state: "offline" };

/**
 * Renders a linked tile summarizing a cluster and its nodes.
 *
 * @param handle - The handle used to build the cluster link
 * @param cluster - The cluster data displayed in the tile
 */
export function ClusterTile({ handle, cluster }: { handle: string; cluster: ClusterCard }) {
  const faces = [...cluster.faces];
  while (faces.length < 4) faces.push(STUB);
  const asleep = isSleeping(cluster.last_chirp_at);
  const empty = cluster.node_count === 0;

  return (
    <Link
      to="/$handle/c/$slug"
      params={{ handle, slug: cluster.slug }}
      className="block rounded-2xl bg-bg-elevated p-4 no-underline shadow-[0_0_0_1px_#20242B] transition-[box-shadow,transform] duration-150 hover:shadow-[0_0_0_1px_#2A2F37] active:scale-[0.995]"
    >
      <div className="grid grid-cols-2 gap-1.5">
        {faces.slice(0, 4).map((face, i) => (
          <div key={`${cluster.id}-${i}`} className="aspect-square min-w-0">
            <BirdFace
              color={face.color}
              state={face.state}
              sleeping={empty || !face.name || (asleep && !isLiveNode(face.state))}
              name={face.name || "stub"}
              size="lg"
              className="h-full w-full !size-full"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl leading-tight font-semibold tracking-[-0.04em] text-fg">
            {cluster.name}
          </h3>
          <p className="mt-1 font-mono text-[11px] tracking-[0.06em] text-fg-subtle">
            {cluster.node_count} {cluster.node_count === 1 ? "node" : "nodes"}
            {cluster.last_chirp_at ? ` · ${relativeTime(cluster.last_chirp_at)}` : " · quiet"}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-fg-subtle uppercase">
          SPX404
        </span>
      </div>
    </Link>
  );
}
