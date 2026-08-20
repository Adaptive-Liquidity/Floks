import type { BirdState } from "@/lib/types";

export const BIRD_STATES = [
  "working",
  "racing",
  "attested",
  "idle",
  "rolled_back",
  "denied",
  "bound",
  "offline",
] as const satisfies readonly BirdState[];

/**
 * Determines whether a bird is in a live node state.
 *
 * @param state - The bird state to evaluate.
 * @returns `true` if the state is `working`, `racing`, or `attested`, `false` otherwise.
 */
export function isLiveNode(state: BirdState): boolean {
  return state === "working" || state === "racing" || state === "attested";
}

/**
 * Determines whether a bird's eyes should appear closed.
 *
 * @param state - The bird's current state
 * @param sleeping - Whether the bird is sleeping
 * @returns `true` if the bird is offline, rolled back, or sleeping outside a live state, `false` otherwise.
 */
export function eyesClosed(state: BirdState, sleeping = false): boolean {
  if (state === "offline" || state === "rolled_back") return true;
  if (sleeping && !isLiveNode(state)) return true;
  return false;
}

/**
 * Determines whether a bird's eyes should remain still for its state.
 *
 * @param state - The bird state to evaluate.
 * @returns `true` if the state is `denied` or `bound`, `false` otherwise.
 */
export function eyesStill(state: BirdState): boolean {
  return state === "denied" || state === "bound";
}

/**
 * Provides the display label for a bird's current state.
 *
 * @param state - The bird state to label
 * @param sleeping - Whether the bird is sleeping
 * @returns The display label for the state
 */
export function nodeStateLabel(state: BirdState, sleeping = false): string {
  if (state === "offline" || (sleeping && !isLiveNode(state))) return "sleeping";
  switch (state) {
    case "working":
      return "executing";
    case "rolled_back":
      return "rolled back";
    default:
      return state;
  }
}

/**
 * Determines the CSS class for a bird's state.
 *
 * @param state - The bird state to classify
 * @param sleeping - Whether the bird is sleeping
 * @returns The CSS class associated with the state
 */
export function nodeStateClass(state: BirdState, sleeping = false): string {
  if (sleeping || state === "offline") return "text-sleep";
  switch (state) {
    case "working":
    case "racing":
    case "attested":
      return "text-working";
    case "idle":
    case "denied":
      return "text-idle";
    case "bound":
      return "text-ember";
    case "rolled_back":
      return "text-sleep";
  }
}

/**
 * Assigns an ordering rank based on the bird's operational state.
 *
 * @param state - The bird state to rank
 * @returns The state rank, from `0` for the most active states to `5` for offline
 */
export function aliveRank(state: BirdState): number {
  switch (state) {
    case "working":
    case "racing":
      return 0;
    case "attested":
      return 1;
    case "idle":
      return 2;
    case "rolled_back":
      return 3;
    case "denied":
    case "bound":
      return 4;
    case "offline":
      return 5;
  }
}
