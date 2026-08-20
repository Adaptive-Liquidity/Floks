import assert from "node:assert/strict";
import test from "node:test";
import { generateClaimCode, generateFlockToken, hashToken, tokensEqual } from "./tokens.ts";

test("claim codes are 6 Crockford chars", () => {
  const code = generateClaimCode();
  assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
});

test("flock tokens are 64 hex chars and hash is not reversible", () => {
  const token = generateFlockToken();
  assert.match(token, /^[0-9a-f]{64}$/);
  const hashed = hashToken(token);
  assert.notEqual(hashed, token);
  assert.equal(hashToken(token), hashed);
});

test("tokensEqual is length-safe", () => {
  assert.equal(tokensEqual("aa", "aa"), true);
  assert.equal(tokensEqual("aa", "ab"), false);
  assert.equal(tokensEqual("aa", "aaa"), false);
});
