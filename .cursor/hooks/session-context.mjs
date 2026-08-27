#!/usr/bin/env node
/**
 * sessionStart — inject Flok harness context (fail-open).
 * Reads JSON from stdin; writes JSON to stdout. Does not call MCP.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function nextBuildId(cwd) {
  try {
    const build = readFileSync(join(cwd, "BUILD.md"), "utf8");
    const nextRow = build.split("\n").find((line) => /\|\s*\*\*S1\*\*/.test(line) && /NEXT/i.test(line));
    if (nextRow) return "S1";
    const m = build.match(/\|\s*\*\*([A-Z]\d+)\*\*[^\n]*\|\s*NEXT\s*\|/i);
    return m ? m[1] : "see BUILD.md";
  } catch {
    return "see BUILD.md";
  }
}

try {
  readStdin();
  const cwd = process.cwd();
  const next = nextBuildId(cwd);
  const additional_context = [
    "Flok harness (sessionStart):",
    `- Stack: TanStack Start + Vite + PGLite/Postgres on 0.0.0.0:8080. Next BUILD: ${next}.`,
    "- Do not preserve Grok App Builder chrome (PWA middleware / extensions.js / __grok) unless you are inside that sandbox.",
    "- Recall continuity: ECC memory search_nodes/open_nodes for Flok, BUILD_next, GrokHarnessDebt; use knowledge-ops / agent-lab vault for durable notes. Never store secrets.",
    "- Authority: AGENTS.md + FINAL_DESIGN.md + BUILD.md. .cursor/ must not contradict AGENTS.md.",
  ].join("\n");

  process.stdout.write(JSON.stringify({ additional_context }) + "\n");
} catch {
  process.stdout.write("{}\n");
}
