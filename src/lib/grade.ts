export { parseSubjectMap, resolveSubject } from "./spx-subject.ts";

export type Grade =
  "SPX AAA" | "SPX AA" | "SPX A" | "SPX BBB" | "SPX BB" | "SPX B" | "SPX D" | "SPX404";

export type GradeSnapshot = {
  grade: Grade;
  confidence: number | null;
  outlined: boolean;
  source: "spx402" | "unavailable";
};

const GRADES: readonly Grade[] = [
  "SPX AAA",
  "SPX AA",
  "SPX A",
  "SPX BBB",
  "SPX BB",
  "SPX B",
  "SPX D",
  "SPX404",
];

const ALLOWED_EVENT_TYPES = new Set([
  "OC_OPENED",
  "OC_AWARDED",
  "OC_FULFILLED",
  "OC_FAILED",
  "OC_SLASHED",
  "OPERATOR_VERIFIED",
]);

export const UNGRADED: GradeSnapshot = {
  grade: "SPX404",
  confidence: null,
  outlined: true,
  source: "unavailable",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGrade(value: unknown): value is Grade {
  return typeof value === "string" && GRADES.includes(value as Grade);
}

export function parseEvidenceGrade(
  value: unknown,
  expected: { subject: string; methodologyVersion: string },
): GradeSnapshot {
  if (!isRecord(value) || value.schema !== "spx.evidence-bundle.v1") return UNGRADED;
  const subject = value.subject;
  const counts = value.counts;
  if (!isRecord(subject) || !isRecord(counts) || !isRecord(counts.by_type)) return UNGRADED;
  if (
    subject.id !== expected.subject ||
    value.methodology_version !== expected.methodologyVersion
  ) {
    return UNGRADED;
  }
  if (subject.category !== "task_executor" && subject.category !== "outcome_contract") {
    return UNGRADED;
  }

  const eventTypes = Object.keys(counts.by_type);
  if (!eventTypes.some((event) => event.startsWith("OC_"))) return UNGRADED;
  if (eventTypes.some((event) => !ALLOWED_EVENT_TYPES.has(event))) return UNGRADED;
  if (!isGrade(value.grade_at_publish)) return UNGRADED;

  const confidence =
    typeof value.confidence_at_publish === "number" &&
    Number.isFinite(value.confidence_at_publish) &&
    value.confidence_at_publish >= 0 &&
    value.confidence_at_publish <= 1
      ? value.confidence_at_publish
      : null;

  return {
    grade: value.grade_at_publish,
    confidence,
    outlined: value.grade_at_publish === "SPX404" || confidence === null || confidence < 0.66,
    source: "spx402",
  };
}

export function aggregateGrades(grades: GradeSnapshot[]): GradeSnapshot {
  const available = grades.filter((grade) => grade.source === "spx402");
  if (available.length === 0) return UNGRADED;
  const grade = available.reduce(
    (lowest, current) =>
      GRADES.indexOf(current.grade) > GRADES.indexOf(lowest) ? current.grade : lowest,
    available[0]!.grade,
  );
  const confidence = available.some((current) => current.confidence === null)
    ? null
    : Math.min(...available.map((current) => current.confidence as number));
  return {
    grade,
    confidence,
    outlined:
      grade === "SPX404" ||
      confidence === null ||
      confidence < 0.66 ||
      available.length !== grades.length,
    source: "spx402",
  };
}
