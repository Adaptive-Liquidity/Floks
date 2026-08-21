import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHandle, validateHandle } from "./handles.ts";

test("normalizes case and trim", () => {
  assert.equal(normalizeHandle("  NorthWind  "), "northwind");
});

test("accepts 3–20 lowercase and hyphenated words", () => {
  assert.deepEqual(validateHandle("ace"), { ok: true, handle: "ace" });
  assert.deepEqual(validateHandle("north-wind"), { ok: true, handle: "north-wind" });
});

test("rejects length, format, reserved", () => {
  assert.equal(validateHandle("ab").ok, false);
  assert.equal(validateHandle("a".repeat(21)).ok, false);
  assert.equal(validateHandle("North_Wind").ok, false);
  assert.equal(validateHandle("-lead").ok, false);
  assert.equal(validateHandle("join").ok, false);
  assert.equal(validateHandle("login").ok, false);
  assert.equal(validateHandle("api").ok, false);
  assert.equal(validateHandle("contracts").ok, false);
  const reserved = validateHandle("FLOk");
  assert.equal(reserved.ok, false);
  if (!reserved.ok) assert.equal(reserved.code, "handle_reserved");
});
