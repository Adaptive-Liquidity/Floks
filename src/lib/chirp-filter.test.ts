import assert from "node:assert/strict";
import test from "node:test";
import { filterChirp } from "./chirp-filter.ts";

test("accepts a short public pulse", () => {
  const out = filterChirp("Drafted 12 follow-ups");
  assert.deepEqual(out, { ok: true, text: "Drafted 12 follow-ups" });
});

test("trims whitespace", () => {
  const out = filterChirp("  shipped  ");
  assert.deepEqual(out, { ok: true, text: "shipped" });
});

test("rejects empty and non-string", () => {
  const empty = filterChirp("");
  const blank = filterChirp("   ");
  const notString = filterChirp(null);
  assert.equal(empty.ok, false);
  assert.equal(blank.ok, false);
  assert.equal(notString.ok, false);
  if (!empty.ok) assert.equal(empty.code, "chirp_empty");
});

test("rejects over 140 characters", () => {
  const out = filterChirp("x".repeat(141));
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.code, "chirp_too_long");
});

test("rejects email, phone, keys, password, token URLs", () => {
  assert.equal(filterChirp("mail me a@b.com").ok, false);
  assert.equal(filterChirp("call 5551234567 now").ok, false);
  assert.equal(filterChirp("here is sk-test secret").ok, false);
  assert.equal(filterChirp("xai-abcdefghi").ok, false);
  assert.equal(filterChirp("Bearer abc.def").ok, false);
  assert.equal(filterChirp("reset the password please").ok, false);
  assert.equal(filterChirp("https://x.test/?token=abc").ok, false);
});
