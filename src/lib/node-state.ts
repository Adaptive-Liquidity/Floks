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

export function isLiveNode(state: BirdState): boolean {
  return state === "working" || state === "racing" || state === "attested";
}

export function eyesClosed(state: BirdState, sleeping = false): boolean {
  if (state === "offline" || state === "rolled_back") return true;
  if (sleeping && !isLiveNode(state)) return true;
  return false;
}

export function eyesStill(state: BirdState): boolean {
  return state === "denied" || state === "bound";
}

export function nodeStateLabel(state: BirdState, sleeping = false): string {
  if (sleeping || state === "offline") return "sleeping";
  switch (state) {
    case "working":
      return "executing";
    case "rolled_back":
      return "rolled back";
    default:
      return state;
  }
}

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
