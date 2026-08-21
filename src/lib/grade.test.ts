import assert from "node:assert/strict";
import test from "node:test";
import { aggregateGrades, parseEvidenceGrade, parseSubjectMap, UNGRADED } from "./grade.ts";
import { resolveSubject } from "./spx-subject.ts";

const SUBJECT = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk";
const METHODOLOGY = "spx-oc-score-v1";

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    schema: "spx.evidence-bundle.v1",
    subject: { id: SUBJECT, category: "task_executor" },
    counts: { by_type: { OC_FULFILLED: 5 } },
    grade_at_publish: "SPX AA",
    confidence_at_publish: 0.8,
    methodology_version: METHODOLOGY,
    ...overrides,
  };
}

function parse(value: unknown) {
  return parseEvidenceGrade(value, { subject: SUBJECT, methodologyVersion: METHODOLOGY });
}

test("parseEvidenceGrade accepts OC grades and separates confidence", () => {
  assert.deepEqual(parse(evidence()), {
    grade: "SPX AA",
    confidence: 0.8,
    outlined: false,
    source: "spx402",
  });
  assert.equal(parse(evidence({ confidence_at_publish: 0.4 })).outlined, true);
  assert.equal(parse(evidence({ confidence_at_publish: 0.66 })).outlined, false);
});

test("parseEvidenceGrade accepts the existing outcome_contract category", () => {
  assert.deepEqual(parse(evidence({ subject: { id: SUBJECT, category: "outcome_contract" } })), {
    grade: "SPX AA",
    confidence: 0.8,
    outlined: false,
    source: "spx402",
  });
});

test("parseEvidenceGrade keeps valid grades outlined without usable confidence", () => {
  const parsed = parse(evidence({ confidence_at_publish: null }));
  assert.equal(parsed.grade, "SPX AA");
  assert.equal(parsed.confidence, null);
  assert.equal(parsed.outlined, true);
  assert.equal(
    parse(evidence({ grade_at_publish: "SPX404", confidence_at_publish: 0.9 })).outlined,
    true,
  );
});

test("parseEvidenceGrade rejects non-OC and forbidden evidence", () => {
  assert.deepEqual(
    parse(evidence({ subject: { id: SUBJECT, category: "tokenized_buyback" } })),
    UNGRADED,
  );
  assert.deepEqual(
    parse(evidence({ counts: { by_type: { OC_FULFILLED: 5, BUYBACK_EXECUTED: 2 } } })),
    UNGRADED,
  );
  assert.deepEqual(parse(evidence({ counts: { by_type: { OPERATOR_VERIFIED: 1 } } })), UNGRADED);
});

test("parseEvidenceGrade accepts OC evidence with operator verification", () => {
  const parsed = parse(
    evidence({ counts: { by_type: { OC_FULFILLED: 5, OPERATOR_VERIFIED: 1 } } }),
  );
  assert.equal(parsed.grade, "SPX AA");
  assert.equal(parsed.source, "spx402");
});

test("parseEvidenceGrade rejects unknown grades and schemas", () => {
  assert.deepEqual(parse(evidence({ grade_at_publish: "SPX A+" })), UNGRADED);
  assert.deepEqual(parse(evidence({ schema: "spx.other.v1" })), UNGRADED);
});

test("parseEvidenceGrade binds the subject and OC methodology", () => {
  assert.deepEqual(
    parse(evidence({ subject: { id: `${SUBJECT}x`, category: "task_executor" } })),
    UNGRADED,
  );
  assert.deepEqual(parse(evidence({ methodology_version: "spx-score-v0.3.0" })), UNGRADED);
});

test("aggregateGrades uses the lowest available grade and confidence", () => {
  const high = parse(evidence({ confidence_at_publish: 0.9 }));
  const low = parse(evidence({ grade_at_publish: "SPX D", confidence_at_publish: 0.4 }));
  assert.deepEqual(aggregateGrades([high, low, UNGRADED]), {
    grade: "SPX D",
    confidence: 0.4,
    outlined: true,
    source: "spx402",
  });
  assert.deepEqual(aggregateGrades([]), UNGRADED);
  assert.equal(aggregateGrades([high, UNGRADED]).outlined, true);
});

test("parseSubjectMap validates subjects and normalizes keys", () => {
  const parsed = parseSubjectMap(
    JSON.stringify({
      " GrowthOps/Outbound ": SUBJECT,
      "bad/key": "not-a-subject",
      "missing-cluster": SUBJECT,
      "bad_handle/outbound": SUBJECT,
    }),
  );
  assert.equal(parsed.get("growthops/outbound"), SUBJECT);
  assert.equal(resolveSubject(parsed, "GrowthOps", "Outbound"), SUBJECT);
  assert.equal(parsed.has("bad/key"), false);
  assert.equal(parsed.has("missing-cluster"), false);
  assert.equal(parsed.has("bad_handle/outbound"), false);
  assert.deepEqual([...parseSubjectMap("{").entries()], []);
});
