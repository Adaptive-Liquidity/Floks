import { aggregateGrades, parseEvidenceGrade, parseSubjectMap, UNGRADED } from "@/lib/grade";
import type { GradeSnapshot } from "@/lib/grade";
import type { ClusterCard } from "@/lib/types";

const POSITIVE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 1_200;

const cache = new Map<string, { value: GradeSnapshot; expiresAt: number }>();
const pending = new Map<string, Promise<GradeSnapshot>>();

async function fetchGrade(
  baseUrl: string,
  subject: string,
  methodologyVersion: string,
): Promise<GradeSnapshot> {
  const cacheKey = `${baseUrl}|${methodologyVersion}|${subject}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const active = pending.get(cacheKey);
  if (active) return active;

  const request = (async () => {
    try {
      const url = `${baseUrl.replace(/\/+$/, "")}/api/public/agent/${encodeURIComponent(subject)}/evidence`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const value = response.ok
        ? parseEvidenceGrade(await response.json(), { subject, methodologyVersion })
        : UNGRADED;
      cache.set(cacheKey, {
        value,
        expiresAt: Date.now() + (value.source === "spx402" ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
      });
      return value;
    } catch {
      cache.set(cacheKey, { value: UNGRADED, expiresAt: Date.now() + NEGATIVE_TTL_MS });
      return UNGRADED;
    } finally {
      pending.delete(cacheKey);
    }
  })();

  pending.set(cacheKey, request);
  return request;
}

export async function getClusterGrades(
  handle: string,
  clusters: ClusterCard[],
): Promise<{ byClusterId: Record<string, GradeSnapshot>; aggregate: GradeSnapshot }> {
  const baseUrl = process.env.FLOK_SPX402_URL?.trim();
  const methodologyVersion = process.env.FLOK_SPX402_OC_METHODOLOGY?.trim();
  const subjects = parseSubjectMap(process.env.FLOK_SPX402_SUBJECTS);
  const entries = await Promise.all(
    clusters.map(async (cluster): Promise<[string, GradeSnapshot]> => {
      const subject = subjects.get(`${handle}/${cluster.slug}`.toLowerCase());
      if (!baseUrl || !methodologyVersion || !subject) return [cluster.id, UNGRADED];
      return [cluster.id, await fetchGrade(baseUrl, subject, methodologyVersion)];
    }),
  );
  const byClusterId = Object.fromEntries(entries);
  return {
    byClusterId,
    aggregate: aggregateGrades(Object.values(byClusterId)),
  };
}
