import { BirdFace } from "@/components/bird-face";
import { nodeStateClass, nodeStateLabel } from "@/lib/node-state";
import { relativeTime } from "@/lib/time";
import type { BirdState } from "@/lib/types";

/**
 * Renders a bird summary tile with its identity, state, role, and optional activity details.
 *
 * @param sleeping - Whether the bird is sleeping.
 * @param chirp - Optional message to display beneath the bird's role.
 * @param at - Optional timestamp for the activity message.
 * @returns The rendered bird summary tile.
 */
export function BirdTile({
  name,
  role,
  color,
  state,
  sleeping,
  chirp,
  at,
  size = "md",
}: {
  name: string;
  role: string;
  color: string;
  state: BirdState;
  sleeping?: boolean;
  chirp?: string | null;
  at?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const closed = Boolean(sleeping);
  return (
    <article className="flex flex-col gap-3">
      <BirdFace color={color} state={state} sleeping={closed} name={name} size={size} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-lg font-semibold tracking-[-0.03em] text-fg">{name}</h3>
          <span
            className={`text-[11px] font-medium tracking-[0.08em] uppercase ${nodeStateClass(state, closed)}`}
          >
            {nodeStateLabel(state, closed)}
          </span>
        </div>
        <p className="text-sm text-fg-muted">{role}</p>
        {chirp ? <p className="mt-1.5 line-clamp-2 text-sm text-fg">{chirp}</p> : null}
        {at ? (
          <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-fg-subtle">
            {relativeTime(at)}
          </p>
        ) : null}
      </div>
    </article>
  );
}
