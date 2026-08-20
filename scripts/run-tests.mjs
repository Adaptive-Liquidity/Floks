import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function collectTests(directory) {
  const tests = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      tests.push(...(await collectTests(path)));
    } else if (entry.name.endsWith(".test.mjs") || entry.name.endsWith(".test.ts")) {
      tests.push(path);
    }
  }
  return tests;
}

const testFiles = (await Promise.all(["scripts", "src"].map(collectTests))).flat().sort();
if (testFiles.length === 0) {
  throw new Error("No test files found");
}

const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...testFiles], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
