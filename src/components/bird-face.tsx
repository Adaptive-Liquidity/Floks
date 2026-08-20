import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { isBrightBird } from "@/lib/colors";
import { eyesClosed, eyesStill, isLiveNode } from "@/lib/node-state";
import { useGaze } from "@/components/gaze";
import type { BirdState } from "@/lib/types";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE: Record<Size, string> = {
  xs: "size-9",
  sm: "size-12",
  md: "size-[5.5rem]",
  lg: "size-36",
};

/**
 * Computes a deterministic animation delay from a string seed.
 *
 * @param seed - The string used to derive the delay
 * @returns A delay between 0 and 2.8 seconds
 */
function delayFor(seed: string) {
  let n = 0;
  for (const ch of seed) n = (n + ch.charCodeAt(0) * 17) % 97;
  return (n / 97) * 2.8;
}

/**
 * Renders a bird face with state-dependent eye animations and visual indicators.
 *
 * @param color - The bird face background color
 * @param state - The bird's current state
 * @param sleeping - Whether to render closed eyes
 * @param name - The bird name used to derive a stable animation delay
 * @param size - The face size
 * @param className - Additional CSS class names
 * @returns The rendered bird face element
 */
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
  const closed = eyesClosed(state, sleeping);
  const still = eyesStill(state);
  const live = isLiveNode(state) && !closed;
  const ink = isBrightBird(color) ? "#0A0B0D" : "#0A0B0D";
  const race = state === "racing" && !closed;
  const idleBlink = state === "idle" && !closed && !still;

  const prevStateRef = useRef<BirdState>(state);
  const [rollbackAnim, setRollbackAnim] = useState(false);

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (state === "rolled_back" && prev !== "rolled_back") {
      setRollbackAnim(true);
    } else if (state !== "rolled_back") {
      setRollbackAnim(false);
    }
  }, [state]);

  useEffect(() => {
    if (closed || still || race) {
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
  }, [gaze, closed, still, race]);

  return (
    <div
      ref={ref}
      className={cn(
        "bird-face relative overflow-hidden",
        SIZE[size],
        state === "working" && live && "bird-face-live",
        race && "bird-face-race",
        state === "attested" && !closed && "bird-face-attested",
        state === "denied" && "bird-face-denied",
        state === "bound" && "bird-face-bound",
        rollbackAnim && "bird-face-rollback",
        closed && state !== "rolled_back" && "bird-face-sleep",
        className,
      )}
      style={{
        backgroundColor: color,
        animationDelay: state === "rolled_back" ? "0s" : `${delay}s`,
      }}
      data-state={closed ? "sleep" : state}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <g
          className="bird-look"
          style={
            closed || still
              ? undefined
              : race
                ? undefined
                : {
                    transform: `translate(${look.x * 10}px, ${look.y * 7}px)`,
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
                className={cn(idleBlink && "bird-eye")}
                style={{
                  transformOrigin: "34px 44px",
                  animationDelay: `${delay}s`,
                  transform: race ? "translate(-6px, 1px)" : undefined,
                }}
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
                className={cn(idleBlink && "bird-eye")}
                style={{
                  transformOrigin: "64px 46px",
                  animationDelay: `${delay + 0.08}s`,
                  transform: race ? "translate(6px, -1px)" : undefined,
                }}
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
        {race ? (
          <g fill={ink}>
            <rect x="63" y="9" width="5" height="13" rx="1.2" />
            <rect x="73" y="9" width="5" height="13" rx="1.2" />
          </g>
        ) : null}
        {state === "denied" ? (
          <g stroke="#F7B33D" strokeWidth="3.2" opacity="0.65">
            <line x1="16" y1="76" x2="84" y2="20" />
            <line x1="24" y1="88" x2="90" y2="34" />
            <line x1="16" y1="20" x2="84" y2="76" />
            <line x1="8" y1="34" x2="76" y2="88" />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
