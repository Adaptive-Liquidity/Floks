import assert from "node:assert/strict";
import test from "node:test";
import { CLUSTER_CAP, mostAlive, planClusters, slugifyCluster } from "./cluster.ts";

test("slugifyCluster kebab-cases and falls back", () => {
  assert.equal(slugifyCluster("Outbound"), "outbound");
  assert.equal(slugifyCluster("Desk 2"), "desk-2");
  assert.equal(slugifyCluster("***"), "crew");
});

test("planClusters defaults unnamed nodes to Crew", () => {
  const plans = planClusters([{ name: "Maya" }, { name: "Jarvis" }]);
  assert.equal(plans.length, 1);
  assert.equal(plans[0]?.name, "Crew");
  assert.equal(plans[0]?.slug, "crew");
  assert.deepEqual(plans[0]?.members, ["Maya", "Jarvis"]);
});

test("planClusters groups by name and splits at 12", () => {
  const outbound = Array.from({ length: CLUSTER_CAP + 2 }, (_, i) => ({
    name: `N${i}`,
    cluster: "Outbound",
  }));
  const research = [{ name: "Ada", cluster: "Research" }];
  const plans = planClusters([...outbound, ...research]);
  assert.equal(plans.length, 3);
  assert.equal(plans[0]?.name, "Outbound 1");
  assert.equal(plans[0]?.members.length, 12);
  assert.equal(plans[1]?.name, "Outbound 2");
  assert.equal(plans[1]?.members.length, 2);
  assert.equal(plans[2]?.name, "Research");
  assert.equal(plans[2]?.slug, "research");
});

test("mostAlive ranks working then idle then offline", () => {
  const ranked = mostAlive([
    { state: "offline" as const, last_chirp_at: "2026-08-20T10:00:00Z" },
    { state: "working" as const, last_chirp_at: "2026-08-20T09:00:00Z" },
    { state: "idle" as const, last_chirp_at: "2026-08-20T11:00:00Z" },
    { state: "working" as const, last_chirp_at: "2026-08-20T12:00:00Z" },
  ]);
  assert.equal(ranked[0]?.state, "working");
  assert.equal(ranked[0]?.last_chirp_at, "2026-08-20T12:00:00Z");
  assert.equal(ranked[1]?.state, "working");
  assert.equal(ranked[2]?.state, "idle");
  assert.equal(ranked[3]?.state, "offline");
});
