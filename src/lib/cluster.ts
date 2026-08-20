import { aliveRank } from "./node-state.ts";
import type { BirdState } from "@/lib/types";

export const CLUSTER_CAP = 12;
export const DEFAULT_CLUSTER_NAME = "Crew";

export type ClusterPlan = {
  name: string;
  slug: string;
  sort_order: number;
  members: string[];
};

export function slugifyCluster(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "crew";
}

export function planClusters(birds: { name: string; cluster?: string | null }[]): ClusterPlan[] {
  const buckets = new Map<string, { label: string; members: string[] }>();
  const order: string[] = [];

  for (const bird of birds) {
    const label = bird.cluster?.trim() || DEFAULT_CLUSTER_NAME;
    const key = label.toLowerCase();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { label, members: [] };
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.members.push(bird.name);
  }

  const plans: ClusterPlan[] = [];
  const usedSlugs = new Set<string>();

  for (const key of order) {
    const bucket = buckets.get(key)!;
    const chunks: string[][] = [];
    for (let i = 0; i < bucket.members.length; i += CLUSTER_CAP) {
      chunks.push(bucket.members.slice(i, i + CLUSTER_CAP));
    }
    chunks.forEach((members, index) => {
      const name = chunks.length === 1 ? bucket.label : `${bucket.label} ${index + 1}`;
      let slug = slugifyCluster(name);
      if (usedSlugs.has(slug)) {
        let n = 2;
        while (usedSlugs.has(`${slug}-${n}`)) n += 1;
        slug = `${slug}-${n}`;
      }
      usedSlugs.add(slug);
      plans.push({ name, slug, sort_order: plans.length, members });
    });
  }

  return plans;
}

export function mostAlive<T extends { state: BirdState; last_chirp_at: string | null }>(
  nodes: T[],
): T[] {
  return [...nodes].sort((a, b) => {
    const byState = aliveRank(a.state) - aliveRank(b.state);
    if (byState !== 0) return byState;
    return (b.last_chirp_at ?? "").localeCompare(a.last_chirp_at ?? "");
  });
}
