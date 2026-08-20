import assert from "node:assert/strict";
import test from "node:test";
import { aliveRank, eyesClosed, isLiveNode, nodeStateLabel } from "./node-state.ts";

test("working is public executing and live", () => {
  assert.equal(nodeStateLabel("working"), "executing");
  assert.equal(isLiveNode("working"), true);
  assert.equal(eyesClosed("working"), false);
});

test("racing and attested stay open; denied and bound are still", () => {
  assert.equal(nodeStateLabel("racing"), "racing");
  assert.equal(nodeStateLabel("attested"), "attested");
  assert.equal(nodeStateLabel("denied"), "denied");
  assert.equal(nodeStateLabel("bound"), "bound");
  assert.equal(eyesClosed("denied"), false);
  assert.equal(eyesClosed("bound"), false);
  assert.equal(isLiveNode("denied"), false);
});

test("rolled back is closed; flock sleep does not close live nodes", () => {
  assert.equal(nodeStateLabel("rolled_back"), "rolled back");
  assert.equal(eyesClosed("rolled_back"), true);
  assert.equal(eyesClosed("idle", true), true);
  assert.equal(eyesClosed("working", true), false);
  assert.equal(eyesClosed("racing", true), false);
});

test("aliveRank prefers executing and racing", () => {
  assert.ok(aliveRank("working") < aliveRank("attested"));
  assert.ok(aliveRank("racing") < aliveRank("idle"));
  assert.ok(aliveRank("idle") < aliveRank("rolled_back"));
  assert.ok(aliveRank("rolled_back") < aliveRank("denied"));
  assert.ok(aliveRank("denied") < aliveRank("offline"));
});
