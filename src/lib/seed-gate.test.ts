import assert from "node:assert/strict";
import test from "node:test";
import { seedHttpAllowed } from "./seed-gate.ts";

test("seed HTTP is off by default", () => {
  assert.equal(seedHttpAllowed({}), false);
  assert.equal(seedHttpAllowed({ NODE_ENV: "development" }), false);
});

test("seed HTTP needs FLOK_ALLOW_SEED=1 and not production", () => {
  assert.equal(seedHttpAllowed({ NODE_ENV: "development", FLOK_ALLOW_SEED: "1" }), true);
  assert.equal(seedHttpAllowed({ NODE_ENV: "production", FLOK_ALLOW_SEED: "1" }), false);
});
