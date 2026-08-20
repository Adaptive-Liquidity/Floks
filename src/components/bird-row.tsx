import { relativeTime } from "@/lib/time";
import { nodeStateClass, nodeStateLabel } from "@/lib/node-state";
import type { BirdWithChirp } from "@/lib/types";

/**
 * Renders a bird's identity, latest chirp, state, and last activity time as a list item.
 *
 * @param bird - The bird and its latest chirp data to display
 * @returns The rendered bird row
 */
export function BirdRow({ bird }: { bird: BirdWithChirp }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-border py-4 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <span
        className="mt-1.5 size-2.5 rounded-full"
        style={{ backgroundColor: bird.color }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-medium text-fg">{bird.name}</span>
          <span className="text-sm text-fg-muted">{bird.role}</span>
        </div>
        <p className="mt-1 text-sm text-fg-muted">{bird.last_chirp ?? "Hasn’t checked in"}</p>
      </div>
      <div className="col-start-2 flex items-center gap-3 text-sm sm:col-start-auto sm:flex-col sm:items-end sm:gap-1">
        <span className={nodeStateClass(bird.state)}>{nodeStateLabel(bird.state)}</span>
        <span className="tabular-nums text-fg-subtle">{relativeTime(bird.last_chirp_at)}</span>
      </div>
    </li>
  );
}
