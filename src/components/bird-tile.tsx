import { BirdFace } from "@/components/bird-face";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";
import type { BirdState } from "@/lib/types";

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
  const closed = Boolean(sleeping || state === "offline");
  return (
    <article className="flex flex-col gap-3">
      <BirdFace
        color={color}
        state={state}
        sleeping={closed}
        name={name}
        size={size}
      />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-lg font-semibold tracking-[-0.03em] text-fg">
            {name}
          </h3>
          <span
            className={cn(
              "text-[11px] font-medium tracking-[0.08em] uppercase",
              closed ? "text-sleep" : state === "working" ? "text-working" : "text-idle",
            )}
          >
            {closed ? "sleeping" : state}
          </span>
        </div>
        <p className="text-sm text-fg-muted">{role}</p>
        {chirp ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-fg">{chirp}</p>
        ) : null}
        {at ? (
          <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-fg-subtle">
            {relativeTime(at)}
          </p>
        ) : null}
      </div>
    </article>
  );
}
