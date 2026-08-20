import assert from "node:assert/strict";
import test from "node:test";
import { emitOcEvidence, OC_DECODER_STATUS } from "./oc-evidence.server.ts";
import {
  classifyOcTransition,
  createOcEvidence,
  OC_EVENT_TYPES,
  ocEvidenceInputSchema,
  type OcEventType,
} from "./oc-evidence.ts";

const SUBJECT = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk";
const INPUT = {
  contract_id: "contract-42",
  cluster_id: "cluster-7",
  cluster_slug: "outbound",
  type: "OC_FULFILLED" as const,
  occurred_at: "2026-08-20T19:00:00.000Z",
  evidence_hash: `sha256:${"a".repeat(64)}`,
  capsule_id: "capsule-9",
};

function event(type: OcEventType, overrides: Record<string, unknown> = {}) {
  return createOcEvidence({ ...INPUT, type, ...overrides }, SUBJECT);
}

test("OC taxonomy is exact and never aliases TASK_COMPLETED", () => {
  assert.deepEqual(OC_EVENT_TYPES, [
    "OC_OPENED",
    "OC_AWARDED",
    "OC_FULFILLED",
    "OC_FAILED",
    "OC_SLASHED",
  ]);
  assert.equal(OC_EVENT_TYPES.includes("TASK_COMPLETED" as never), false);
});

test("OC evidence binds the task-executor subject and event severity", () => {
  const fulfilled = event("OC_FULFILLED");
  assert.equal(fulfilled.schema, "flok.oc-evidence.v1");
  assert.match(fulfilled.event_id, /^[0-9a-f-]{36}$/);
  assert.equal(fulfilled.category, "task_executor");
  assert.equal(fulfilled.subject, SUBJECT);
  assert.equal(fulfilled.evidence_hash, INPUT.evidence_hash);
  assert.equal(Object.isFrozen(fulfilled), true);

  assert.deepEqual(Object.fromEntries(OC_EVENT_TYPES.map((type) => [type, event(type).severity])), {
    OC_OPENED: "info",
    OC_AWARDED: "info",
    OC_FULFILLED: "success",
    OC_FAILED: "critical",
    OC_SLASHED: "critical",
  });
});

test("OC constructor validates at runtime and protects trusted fields", () => {
  assert.equal(
    ocEvidenceInputSchema.safeParse({ ...INPUT, type: "TASK_COMPLETED" }).success,
    false,
  );
  assert.equal(ocEvidenceInputSchema.safeParse({ ...INPUT, evidence_hash: "abc" }).success, false);
  assert.throws(() => createOcEvidence({ ...INPUT, extra: "not allowed" }, SUBJECT));
  assert.throws(() =>
    createOcEvidence(
      { ...INPUT, schema: "spx.evidence.v1", category: "general", severity: "success" },
      SUBJECT,
    ),
  );
  assert.throws(() => createOcEvidence(INPUT, "not-a-subject"));
});

test("OC lifecycle accepts only opened, awarded, then one terminal event", () => {
  const opened = event("OC_OPENED");
  const awarded = event("OC_AWARDED");
  assert.equal(classifyOcTransition(null, opened), "advance");
  assert.equal(classifyOcTransition(opened, awarded), "advance");
  assert.equal(classifyOcTransition(awarded, event("OC_FULFILLED")), "advance");
  assert.equal(classifyOcTransition(awarded, event("OC_FAILED")), "advance");
  assert.equal(classifyOcTransition(awarded, event("OC_SLASHED")), "advance");

  assert.equal(classifyOcTransition(null, awarded), "invalid");
  assert.equal(classifyOcTransition(opened, event("OC_FULFILLED")), "invalid");
  assert.equal(classifyOcTransition(event("OC_FULFILLED"), event("OC_SLASHED")), "invalid");
  assert.equal(
    classifyOcTransition(opened, event("OC_AWARDED", { occurred_at: "2026-08-20T18:59:59.000Z" })),
    "invalid",
  );
});

test("OC lifecycle distinguishes retries from identity conflicts", () => {
  for (const type of OC_EVENT_TYPES) {
    const original = event(type);
    assert.equal(classifyOcTransition(original, original), "duplicate");
    assert.equal(classifyOcTransition(original, event(type)), "conflict");
  }
  assert.equal(
    classifyOcTransition(event("OC_OPENED"), event("OC_AWARDED", { contract_id: "contract-99" })),
    "conflict",
  );
  assert.equal(
    classifyOcTransition(event("OC_OPENED"), event("OC_AWARDED", { cluster_id: "cluster-99" })),
    "conflict",
  );
  assert.equal(
    classifyOcTransition(event("OC_OPENED"), event("OC_AWARDED", { cluster_slug: "research" })),
    "conflict",
  );
  assert.equal(
    classifyOcTransition(
      event("OC_OPENED"),
      createOcEvidence(
        { ...INPUT, type: "OC_AWARDED" },
        "223456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk",
      ),
    ),
    "conflict",
  );
});

test("OC emitter remains fail-closed while upstream decoder is unavailable", async () => {
  const evidence = event("OC_FULFILLED");
  const result = await emitOcEvidence(evidence);
  assert.deepEqual(OC_DECODER_STATUS, {
    category: "task_executor",
    decoderLive: false,
    reason: "upstream_decoder_unavailable",
  });
  assert.equal(Object.isFrozen(OC_DECODER_STATUS), true);
  assert.deepEqual(result, {
    ok: false,
    code: "upstream_decoder_unavailable",
    decoderLive: false,
  });
  assert.equal(Object.isFrozen(result), true);
});
