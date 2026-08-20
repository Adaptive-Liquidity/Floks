import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJsonStringify, sha256Hex } from "./evidence-hash.server.ts";

test("canonical JSON serializes a single sparse array slot as null", async () => {
  const canonical = canonicalJsonStringify(Array(1));

  assert.equal(canonical, "[null]");
  assert.equal(
    await sha256Hex(canonical),
    "1d8fc6ceb1f94c6326d6d5483d258fcb2e179e9869325b245d105c2219bf69fd",
  );
});

test("canonical JSON preserves every sparse array slot", async () => {
  const sparseCanonical = canonicalJsonStringify(Array(2));
  const denseCanonical = canonicalJsonStringify([null, null]);

  assert.equal(sparseCanonical, "[null,null]");
  assert.equal(denseCanonical, "[null,null]");
  assert.equal(
    await sha256Hex(sparseCanonical),
    "95cb9b4f84ceff132cc7a875d8c192bf4997016a939ee64141c1fd628c0e8738",
  );
  assert.equal(await sha256Hex(denseCanonical), await sha256Hex(sparseCanonical));
});
