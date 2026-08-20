import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { isBrightBird } from "@/lib/colors";
import { useGaze } from "@/components/gaze";
import type { BirdState } from "@/lib/types";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE: Record<Size, string> = {
  xs: "size-9",
  sm: "size-12",
  md: "size-[5.5rem]",
  lg: "size-36",
};

function delayFor(seed: string) {
  let n = 0;
  for (const ch of seed) n = (n + ch.charCodeAt(0) * 17) % 97;
  return (n / 97) * 2.8;
}

export function BirdFace({
  color,
  state,
  sleeping = false,
  name,
  size = "md",
  className,
}: {
  color: string;
  state: BirdState;
  sleeping?: boolean;
  name: string;
  size?: Size;
  className?: string;
}) {
  const gaze = useGaze();
  const ref = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const uid = useId();
  const delay = useMemo(() => delayFor(name + uid), [name, uid]);
  const closed = sleeping || state === "offline";
  const ink = isBrightBird(color) ? "#0A0B0D" : "#0A0B0D";

  useEffect(() => {
    if (closed) {
      setLook({ x: 0, y: 0 });
      return;
    }
    if (!gaze) return;
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const nx = Math.max(-1, Math.min(1, (gaze.x - cx) / Math.max(120, box.width * 3)));
    const ny = Math.max(-1, Math.min(1, (gaze.y - cy) / Math.max(120, box.height * 3)));
    setLook({ x: nx, y: ny });
  }, [gaze, closed]);

  return (
    <div
      ref={ref}
      className={cn(
        "bird-face relative overflow-hidden",
        SIZE[size],
        state === "working" && !closed && "bird-face-live",
        closed && "bird-face-sleep",
        className,
      )}
      style={{
        backgroundColor: color,
        animationDelay: `${delay}s`,
      }}
      data-state={closed ? "sleep" : state}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <g
          className={cn("bird-look", !closed && !gaze && "bird-look-wander")}
          style={
            closed
              ? undefined
              : {
                  transform: `translate(${look.x * 10}px, ${look.y * 7}px)`,
                  animationDelay: `${delay}s`,
                }
          }
        >
          {closed ? (
            <>
              <rect x="26" y="46" width="18" height="5" rx="2.5" fill={ink} />
              <rect x="56" y="46" width="18" height="5" rx="2.5" fill={ink} />
            </>
          ) : (
            <>
              <g
                className="bird-eye"
                style={{ transformOrigin: "34px 44px", animationDelay: `${delay}s` }}
              >
                <rect
                  x="26"
                  y="28"
                  width="14"
                  height="32"
                  rx="7"
                  fill={ink}
                  transform="rotate(-18 33 44)"
                />
              </g>
              <g
                className="bird-eye"
                style={{ transformOrigin: "64px 46px", animationDelay: `${delay + 0.08}s` }}
              >
                <rect
                  x="56"
                  y="30"
                  width="14"
                  height="32"
                  rx="7"
                  fill={ink}
                  transform="rotate(-18 63 46)"
                />
              </g>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
