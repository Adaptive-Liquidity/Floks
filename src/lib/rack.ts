export const RACK_MIN = 2;
export const RACK_MAX = 4;
export const RACK_CAP = 8;
export const DEFAULT_RACK_NAME = "Shift";

export type RackPlan = {
  name: string;
  slug: string;
  sort_order: number;
  clusters: string[];
};

export type RackPlanError = {
  ok: false;
  error: string;
  code: string;
};

export function slugifyRack(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "shift";
}

function uniqueLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function planRacks(
  racks: { name?: string | null; clusters: string[] }[],
): { ok: true; plans: RackPlan[] } | RackPlanError {
  if (racks.length > RACK_CAP) {
    return {
      ok: false,
      error: `A crew can pin at most ${RACK_CAP} racks.`,
      code: "rack_cap",
    };
  }

  const plans: RackPlan[] = [];
  const usedSlugs = new Set<string>();

  for (const rack of racks) {
    const clusters = uniqueLabels(rack.clusters);
    if (clusters.length < RACK_MIN || clusters.length > RACK_MAX) {
      return {
        ok: false,
        error: "A rack pins 2–4 roosts.",
        code: "rack_size",
      };
    }
    const name = rack.name?.trim() || DEFAULT_RACK_NAME;
    let slug = slugifyRack(name);
    if (usedSlugs.has(slug)) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n += 1;
      slug = `${slug}-${n}`;
    }
    usedSlugs.add(slug);
    plans.push({ name, slug, sort_order: plans.length, clusters });
  }

  return { ok: true, plans };
}
