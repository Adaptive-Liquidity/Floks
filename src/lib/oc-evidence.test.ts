import assert from "node:assert/strict";
import test from "node:test";
import { getSql } from "./db.ts";
import { canonicalJsonStringify, sha256Hex } from "./evidence-hash.server.ts";
import {
  classifyOcTransition,
  createOcEvidence,
  emitOcEvidence,
  OC_DECODER_STATUS,
  persistOcEvidence,
  probeDecoderStatus,
} from "./oc-evidence.server.ts";
import {
  classifyOcTransitionFromState,
  OC_EVENT_TYPES,
  ocEvidenceInputSchema,
} from "./oc-evidence.ts";

const SUBJECT = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk";
process.env.FLOK_SPX402_SUBJECTS = JSON.stringify({ "growthops/outbound": SUBJECT });

const INPUT = {
  handle: "growthops",
  contract_id: "contract-42",
  cluster_id: "cluster-7",
  cluster_slug: "outbound",
  type: "OC_FULFILLED" as const,
  occurred_at: "2026-08-20T19:00:00.000Z",
  idempotency_key: "attempt-1",
  capsule_id: "capsule-9",
};

function event(type: (typeof OC_EVENT_TYPES)[number], overrides: Record<string, unknown> = {}) {
  return createOcEvidence({ ...INPUT, type, ...overrides });
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

test("canonical evidence hashing matches the golden vector", async () => {
  const canonical = canonicalJsonStringify({ b: 2, a: 1, omitted: undefined });
  assert.equal(canonical, '{"a":1,"b":2}');
  assert.equal(
    await sha256Hex(canonical),
    "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
  );
});

test("OC evidence matches the fixed identity golden vector", async () => {
  const fulfilled = await event("OC_FULFILLED");
  assert.equal(fulfilled.schema, "flok.oc-evidence.v1");
  assert.equal(
    fulfilled.event_id,
    "oc_e65ac6a4d5d0f660a5ece6d2b1935bb9493da69674d2a193e3cb82b071681c89",
  );
  assert.equal(fulfilled.category, "task_executor");
  assert.equal(fulfilled.subject, SUBJECT);
  assert.equal(
    fulfilled.evidence_hash,
    "sha256:259066ccfc6d5b9e60685f7d9ffc14c5dc999bf19d78b22dd90297c10a663d4e",
  );
  assert.equal(Object.isFrozen(fulfilled), true);

  assert.deepEqual(
    Object.fromEntries(
      await Promise.all(
        OC_EVENT_TYPES.map(async (type) => [type, (await event(type)).severity] as const),
      ),
    ),
    {
      OC_OPENED: "info",
      OC_AWARDED: "info",
      OC_FULFILLED: "success",
      OC_FAILED: "critical",
      OC_SLASHED: "critical",
    },
  );
});

test("OC constructor rejects caller-owned trust fields", async () => {
  assert.equal(
    ocEvidenceInputSchema.safeParse({ ...INPUT, type: "TASK_COMPLETED" }).success,
    false,
  );
  assert.equal(
    ocEvidenceInputSchema.safeParse({ ...INPUT, evidence_hash: `sha256:${"a".repeat(64)}` })
      .success,
    false,
  );
  assert.equal(ocEvidenceInputSchema.safeParse({ ...INPUT, subject: SUBJECT }).success, false);
  await assert.rejects(createOcEvidence({ ...INPUT, extra: "not allowed" }));
});

test("OC lifecycle accepts only opened, awarded, then one terminal event", async () => {
  const opened = await event("OC_OPENED");
  const awarded = await event("OC_AWARDED");
  assert.equal(classifyOcTransitionFromState(null, opened), "advance");
  assert.equal(classifyOcTransitionFromState(opened, awarded), "advance");
  assert.equal(classifyOcTransitionFromState(awarded, await event("OC_FULFILLED")), "advance");
  assert.equal(classifyOcTransitionFromState(awarded, await event("OC_FAILED")), "advance");
  assert.equal(classifyOcTransitionFromState(awarded, await event("OC_SLASHED")), "advance");

  assert.equal(classifyOcTransitionFromState(null, awarded), "invalid");
  assert.equal(classifyOcTransitionFromState(opened, await event("OC_FULFILLED")), "invalid");
  assert.equal(
    classifyOcTransitionFromState(await event("OC_FULFILLED"), await event("OC_SLASHED")),
    "invalid",
  );
  assert.equal(
    classifyOcTransitionFromState(
      opened,
      await event("OC_AWARDED", { occurred_at: "2026-08-20T18:59:59.000Z" }),
    ),
    "invalid",
  );
});

test("deterministic event IDs make retries duplicates", async () => {
  for (const type of OC_EVENT_TYPES) {
    const original = await event(type);
    const retry = await event(type);
    assert.equal(retry.event_id, original.event_id);
    assert.equal(retry.evidence_hash, original.evidence_hash);
    assert.equal(classifyOcTransitionFromState(original, retry), "duplicate");
  }
  assert.equal(
    classifyOcTransitionFromState(
      await event("OC_OPENED"),
      await event("OC_AWARDED", { contract_id: "contract-99" }),
    ),
    "conflict",
  );
});

test("OC persistence classifies from DB and enqueues atomically", async () => {
  const contractId = "contract-persist";
  const opened = await event("OC_OPENED", { contract_id: contractId, idempotency_key: "open-1" });
  assert.equal(await classifyOcTransition(opened), "advance");
  const first = await persistOcEvidence(opened);
  const retry = await persistOcEvidence(
    await event("OC_OPENED", {
      contract_id: contractId,
      idempotency_key: "open-1",
    }),
  );
  assert.equal(first.transition, "advance");
  assert.equal(retry.transition, "duplicate");

  const sql = await getSql();
  const rows = await sql.query<{ events: number; outbox: number }>(
    `select
      (select count(*)::int from oc_evidence_events where contract_id = $1) as events,
      (select count(*)::int from oc_evidence_outbox o join oc_evidence_events e using (event_id) where e.contract_id = $1) as outbox`,
    [contractId],
  );
  assert.deepEqual(rows[0], { events: 1, outbox: 1 });
});

test("OC persistence rolls back event and lifecycle when outbox enqueue fails", async () => {
  const contractId = "contract-atomicity";
  const opened = await event("OC_OPENED", {
    contract_id: contractId,
    idempotency_key: "atomic-1",
  });
  await assert.rejects(
    persistOcEvidence(opened, {
      beforeOutboxInsert: () => {
        throw new Error("injected_outbox_failure");
      },
    }),
    /injected_outbox_failure/,
  );

  const sql = await getSql();
  const eventRows = await sql.query(
    "select event_id from oc_evidence_events where contract_id = $1",
    [contractId],
  );
  const lifecycleRows = await sql.query(
    "select contract_id from oc_lifecycle where contract_id = $1",
    [contractId],
  );
  assert.equal(eventRows.length, 0);
  assert.equal(lifecycleRows.length, 0);
});

test("OC emitter probes fail-closed and performs no ingestion fetch", async () => {
  const evidence = await event("OC_FULFILLED");
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("unexpected_fetch");
  }) as typeof fetch;
  const result = await emitOcEvidence(evidence).finally(() => {
    globalThis.fetch = originalFetch;
  });
  const invalidResult = await emitOcEvidence({
    ...evidence,
    evidence_hash: `sha256:${"0".repeat(64)}`,
  });
  const failedProbe = await probeDecoderStatus(async () => {
    throw new Error("offline");
  });
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
  assert.equal(failedProbe.decoderLive, false);
  assert.equal(failedProbe.reason, "probe_failed");
  assert.equal(invalidResult.code, "invalid_evidence");
  assert.equal(invalidResult.decoderLive, false);
  assert.equal(fetchCalls, 0);
  assert.equal(Object.isFrozen(result), true);
});
