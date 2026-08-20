import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_RACK_NAME, RACK_CAP, planRacks, slugifyRack } from "./rack.ts";

test("slugifyRack kebab-cases and falls back to shift", () => {
  assert.equal(slugifyRack("Night Shift"), "night-shift");
  assert.equal(slugifyRack("Desk 2"), "desk-2");
  assert.equal(slugifyRack("***"), "shift");
});

test("planRacks defaults unnamed racks to Shift", () => {
  const planned = planRacks([{ clusters: ["Studio", "Desk"] }]);
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(planned.plans.length, 1);
  assert.equal(planned.plans[0]?.name, DEFAULT_RACK_NAME);
  assert.equal(planned.plans[0]?.slug, "shift");
  assert.deepEqual(planned.plans[0]?.clusters, ["Studio", "Desk"]);
});

test("planRacks rejects fewer than 2 or more than 4 roosts", () => {
  const one = planRacks([{ name: "Shift", clusters: ["Studio"] }]);
  assert.equal(one.ok, false);
  if (one.ok) return;
  assert.equal(one.code, "rack_size");

  const five = planRacks([{ name: "Shift", clusters: ["A", "B", "C", "D", "E"] }]);
  assert.equal(five.ok, false);
  if (five.ok) return;
  assert.equal(five.code, "rack_size");
});

test("planRacks drops duplicate roost labels and caps crew racks", () => {
  const dupes = planRacks([{ name: "Shift", clusters: ["Studio", "studio", "Desk"] }]);
  assert.equal(dupes.ok, true);
  if (!dupes.ok) return;
  assert.deepEqual(dupes.plans[0]?.clusters, ["Studio", "Desk"]);

  const tooMany = planRacks(
    Array.from({ length: RACK_CAP + 1 }, (_, i) => ({
      name: `Shift ${i}`,
      clusters: ["Studio", "Desk"],
    })),
  );
  assert.equal(tooMany.ok, false);
  if (tooMany.ok) return;
  assert.equal(tooMany.code, "rack_cap");
});

test("planRacks splits colliding slugs", () => {
  const planned = planRacks([
    { name: "Shift", clusters: ["Studio", "Desk"] },
    { name: "Shift", clusters: ["Outbound", "Research"] },
  ]);
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(planned.plans[0]?.slug, "shift");
  assert.equal(planned.plans[1]?.slug, "shift-2");
});

test("planRacks preserves explicit slugs and rejects collisions", () => {
  const planned = planRacks([
    { name: "Shift", slug: "shift-2", clusters: ["Studio", "Desk"] },
    { name: "Shift", clusters: ["Outbound", "Research"] },
  ]);
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(planned.plans[0]?.slug, "shift-2");
  assert.equal(planned.plans[1]?.slug, "shift");

  const duplicate = planRacks([
    { name: "Shift", slug: "shift", clusters: ["Studio", "Desk"] },
    { name: "Shift 2", slug: "shift", clusters: ["Outbound", "Research"] },
  ]);
  assert.equal(duplicate.ok, false);
  if (duplicate.ok) return;
  assert.equal(duplicate.code, "duplicate_rack");
});
