import assert from "node:assert/strict";
import test from "node:test";
import { devUserFallbackAllowed } from "./fallback.ts";

test("requireUserId fails closed when production auth is disabled", () => {
  assert.equal(devUserFallbackAllowed({ NODE_ENV: "production" }), false);
  assert.equal(
    devUserFallbackAllowed({ NODE_ENV: "development", DATABASE_URL: "postgres://flok" }),
    false,
  );
  assert.equal(devUserFallbackAllowed({ NODE_ENV: "development" }), true);
});
