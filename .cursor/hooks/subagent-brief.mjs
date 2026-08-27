#!/usr/bin/env node
/**
 * subagentStart — inject ownership + AGENTS constraints (fail-open).
 */
import { readFileSync } from "node:fs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

try {
  readStdin();
  const additional_context = [
    "Flok subagent brief:",
    "- Respect assigned file ownership; no drive-by refactors outside your task.",
    "- Obey AGENTS.md: port 8080, no Sky, Hall closed until S2, keep birds/chirps until BUILD rename.",
    "- Do not treat BRAIN or reference/spx402 as the product spec.",
    "- Smallest coherent change. Lead owns commits/PRs.",
  ].join("\n");
  process.stdout.write(JSON.stringify({ additional_context }) + "\n");
} catch {
  process.stdout.write("{}\n");
}
