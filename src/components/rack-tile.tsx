import { Link } from "@tanstack/react-router";
import { BirdFace } from "@/components/bird-face";
import { isLiveNode } from "@/lib/node-state";
import { isSleeping } from "@/lib/time";
import type { ClusterFace, RackCard } from "@/lib/types";

const STUB: ClusterFace = { name: "", color: "#16191F", state: "offline" };

export function RackTile({ handle, rack }: { handle: string; rack: RackCard }) {
  const nodeCount = rack.roosts.reduce((n, roost) => n + roost.node_count, 0);
  const names = rack.roosts.map((roost) => roost.name).join(" · ");

  return (
    <Link
      to="/$handle/r/$slug"
      params={{ handle, slug: rack.slug }}
      className="block rounded-2xl bg-bg-elevated p-4 no-underline shadow-[0_0_0_1px_#20242B] transition-[box-shadow,transform] duration-150 hover:shadow-[0_0_0_1px_#2A2F37] active:scale-[0.995]"
    >
      <div className="grid grid-cols-2 gap-1.5">
        {rack.roosts.map((roost) => {
          const faces = [...roost.faces];
          while (faces.length < 4) faces.push(STUB);
          const asleep = isSleeping(roost.last_chirp_at);
          const empty = roost.node_count === 0;
          return (
            <div key={roost.id} className="grid grid-cols-2 gap-0.5">
              {faces.slice(0, 4).map((face, i) => (
                <div key={`${roost.id}-${i}`} className="aspect-square min-w-0">
                  <BirdFace
                    color={face.color}
                    state={face.state}
                    sleeping={empty || !face.name || (asleep && !isLiveNode(face.state))}
                    name={face.name || "stub"}
                    size="sm"
                    className="h-full w-full !size-full"
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.14em] text-fg-subtle uppercase">Rack</p>
          <h3 className="font-display mt-1 text-xl leading-tight font-semibold tracking-[-0.04em] text-fg">
            {rack.name}
          </h3>
          <p className="mt-1 truncate font-mono text-[11px] tracking-[0.06em] text-fg-subtle">
            {names}
          </p>
          <p className="mt-1 font-mono text-[11px] tracking-[0.06em] text-fg-subtle">
            {rack.roosts.length} {rack.roosts.length === 1 ? "roost" : "roosts"} · {nodeCount}{" "}
            {nodeCount === 1 ? "node" : "nodes"}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-fg-subtle uppercase">
          SPX404
        </span>
      </div>
    </Link>
  );
}
