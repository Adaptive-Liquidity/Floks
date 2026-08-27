#!/usr/bin/env node
/**
 * stop — remind verification when src/ or scripts/ were touched (fail-open).
 */
import { readFileSync } from "node:fs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function touchedProduct(payload) {
  const blob = JSON.stringify(payload ?? {});
  return /(?:^|[\\/"'])(?:src|scripts)[/\\]/i.test(blob) || /"path"\s*:\s*"[^"]*(?:src|scripts)[/\\]/i.test(blob);
}

try {
  const raw = readStdin();
  let payload = {};
  try {
    payload = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (!touchedProduct(payload)) {
    process.stdout.write("{}\n");
  } else {
    const followup_message = [
      "Flok stop gate: product files may have changed.",
      "Before claiming done, run: npm run typecheck && npm test (and npm run verify / bash scripts/smoke.sh for behavior).",
      "If a BUILD ID finished, persist outcomes to ECC memory (Flok / BUILD_next) — no secrets.",
    ].join(" ");
    process.stdout.write(JSON.stringify({ followup_message }) + "\n");
  }
} catch {
  process.stdout.write("{}\n");
}
