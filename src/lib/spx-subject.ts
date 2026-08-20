const SUBJECT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
const SUBJECT_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSubjectMap(raw: string | undefined): Map<string, string> {
  if (!raw) return new Map();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return new Map();
    return new Map(
      Object.entries(value)
        .map(([key, subject]) => [key.trim().toLowerCase(), subject] as const)
        .filter(
          (entry): entry is readonly [string, string] =>
            SUBJECT_KEY_PATTERN.test(entry[0]) &&
            typeof entry[1] === "string" &&
            SUBJECT_PATTERN.test(entry[1]),
        )
        .map(([key, subject]) => [key, subject]),
    );
  } catch {
    return new Map();
  }
}

export function resolveSubject(
  subjects: ReadonlyMap<string, string>,
  handle: string,
  clusterSlug: string,
): string | null {
  return subjects.get(`${handle.trim()}/${clusterSlug.trim()}`.toLowerCase()) ?? null;
}
