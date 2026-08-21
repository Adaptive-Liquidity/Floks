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

const CONTRACT_DEADLINE = "2026-08-25T19:00:00.000Z";

async function ensureContract(contractId: string, deadline = CONTRACT_DEADLINE) {
  const sql = await getSql();
  await sql.query(
    `insert into outcome_contracts (
       id, poster_user_id, poster, outcome_class, outcome_text, proof_requirements,
       deadline, bound, visibility, version, contract_hash
     ) values ($1, $2, $3, 'artifact', 'Produce a verifiable test artifact.',
       '[]'::jsonb, $4, '{"amount":"1","currency":"USD"}'::jsonb,
       'public', 1, $5)
     on conflict (id) do nothing`,
    [
      contractId,
      `test-user-${contractId}`,
      `@poster_${contractId
        .replace(/[^a-z0-9]/gi, "")
        .padEnd(32, "0")
        .slice(0, 32)}`,
      deadline,
      `sha256:${contractId.padEnd(64, "0").slice(0, 64)}`,
    ],
  );
}

async function event(
  type: (typeof OC_EVENT_TYPES)[number],
  overrides: Record<string, unknown> = {},
) {
  const input = { ...INPUT, type, ...overrides };
  await ensureContract(String(input.contract_id));
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
  assert.equal(fulfilled.schema, "flok.oc-evidence.v2");
  assert.equal(
    fulfilled.event_id,
    "oc_e65ac6a4d5d0f660a5ece6d2b1935bb9493da69674d2a193e3cb82b071681c89",
  );
  assert.equal(fulfilled.category, "task_executor");
  assert.equal(fulfilled.subject, SUBJECT);
  assert.equal(
    fulfilled.evidence_hash,
    "sha256:99c01f3b1284f61bdd41473136f6a8f9f51c0a1013bccf496f127ac31353e7f8",
  );
  assert.equal(fulfilled.deadline_at, undefined);
  assert.equal((await event("OC_OPENED")).deadline_at, CONTRACT_DEADLINE);
  assert.equal((await event("OC_AWARDED")).deadline_at, CONTRACT_DEADLINE);
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

test("OC_FULFILLED requires a capsule_id", async () => {
  const { capsule_id: _omitted, ...fulfilledWithoutCapsule } = INPUT;
  assert.equal(ocEvidenceInputSchema.safeParse(fulfilledWithoutCapsule).success, false);
  await assert.rejects(createOcEvidence(fulfilledWithoutCapsule));
  await event("OC_FULFILLED");
  await event("OC_OPENED", { capsule_id: undefined });
});

test("OC evidence preserves valid long-horizon contract deadlines", async () => {
  const contractId = "contract-long-horizon";
  const deadline = "2099-01-01T00:00:00.000Z";
  await ensureContract(contractId, deadline);
  const opened = await event("OC_OPENED", {
    contract_id: contractId,
    occurred_at: "2026-08-20T19:00:00.000Z",
  });
  assert.equal(opened.deadline_at, deadline);
});

test("OC lifecycle accepts only opened, awarded, then one terminal event", async () => {
  const opened = await event("OC_OPENED");
  const awarded = await event("OC_AWARDED");
  assert.equal(classifyOcTransitionFromState(null, opened), "advance");
  assert.equal(classifyOcTransitionFromState(opened, awarded), "advance");
  assert.equal(classifyOcTransitionFromState(opened, await event("OC_FAILED")), "advance");
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

test("OC persistence advances latest_event_id through opened, awarded, terminal", async () => {
  const contractId = "contract-lifecycle";
  const sql = await getSql();
  const latestEventId = async () =>
    (
      await sql.query<{ latest_event_id: string | null }>(
        "select latest_event_id from oc_lifecycle where contract_id = $1",
        [contractId],
      )
    )[0]?.latest_event_id;

  const opened = await event("OC_OPENED", {
    contract_id: contractId,
    idempotency_key: "life-open",
    occurred_at: "2026-08-20T19:00:00.000Z",
  });
  const first = await persistOcEvidence(opened);
  assert.equal(first.transition, "advance");
  assert.equal(await latestEventId(), opened.event_id);

  const awarded = await event("OC_AWARDED", {
    contract_id: contractId,
    idempotency_key: "life-award",
    occurred_at: "2026-08-20T19:01:00.000Z",
  });
  const second = await persistOcEvidence(awarded);
  assert.equal(second.transition, "advance");
  assert.equal(await latestEventId(), awarded.event_id);

  const fulfilled = await event("OC_FULFILLED", {
    contract_id: contractId,
    idempotency_key: "life-fulfill",
    occurred_at: "2026-08-20T19:02:00.000Z",
    capsule_id: "capsule-9",
  });
  const third = await persistOcEvidence(fulfilled);
  assert.equal(third.transition, "advance");
  assert.equal(await latestEventId(), fulfilled.event_id);

  const rows = await sql.query<{ type: string; outbox: number }>(
    `select e.type, (select count(*)::int from oc_evidence_outbox o where o.event_id = e.event_id) as outbox
     from oc_evidence_events e where e.contract_id = $1 order by e.occurred_at`,
    [contractId],
  );
  assert.deepEqual(rows, [
    { type: "OC_OPENED", outbox: 1 },
    { type: "OC_AWARDED", outbox: 1 },
    { type: "OC_FULFILLED", outbox: 1 },
  ]);
});

test("OC persistence allows only one of two competing terminal events", async () => {
  const contractId = "contract-terminal-race";
  const opened = await event("OC_OPENED", {
    contract_id: contractId,
    idempotency_key: "race-open",
    occurred_at: "2026-08-20T19:00:00.000Z",
  });
  const awarded = await event("OC_AWARDED", {
    contract_id: contractId,
    idempotency_key: "race-award",
    occurred_at: "2026-08-20T19:01:00.000Z",
  });
  assert.equal((await persistOcEvidence(opened)).transition, "advance");
  assert.equal((await persistOcEvidence(awarded)).transition, "advance");

  const fulfilled = await event("OC_FULFILLED", {
    contract_id: contractId,
    idempotency_key: "race-fulfill",
    occurred_at: "2026-08-20T19:02:00.000Z",
    capsule_id: "capsule-9",
  });
  const slashed = await event("OC_SLASHED", {
    contract_id: contractId,
    idempotency_key: "race-slash",
    occurred_at: "2026-08-20T19:02:00.000Z",
  });
  const results = await Promise.all([persistOcEvidence(fulfilled), persistOcEvidence(slashed)]);
  const transitions = results.map((result) => result.transition);
  // Exactly one terminal write wins; the loser is rejected (conflict/invalid)
  // without persisting, regardless of which attempt acquires the lock first.
  assert.equal(transitions.filter((transition) => transition === "advance").length, 1);

  const sql = await getSql();
  const rows = await sql.query<{ events: number; outbox: number; latest: string | null }>(
    `select
      (select count(*)::int from oc_evidence_events where contract_id = $1) as events,
      (select count(*)::int from oc_evidence_outbox o join oc_evidence_events e using (event_id) where e.contract_id = $1) as outbox,
      (select latest_event_id from oc_lifecycle where contract_id = $1) as latest`,
    [contractId],
  );
  assert.equal(rows[0]?.events, 3);
  assert.equal(rows[0]?.outbox, 3);
  const winner = results[0]?.transition === "advance" ? fulfilled : slashed;
  assert.equal(rows[0]?.latest, winner.event_id);
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

test("durable OC evidence keeps subject binding when env map changes", async () => {
  const contractId = "contract-subject-binding";
  const opened = await event("OC_OPENED", {
    contract_id: contractId,
    idempotency_key: "bind-open",
    occurred_at: "2026-08-20T19:00:00.000Z",
  });
  assert.equal(opened.subject, SUBJECT);
  assert.equal((await persistOcEvidence(opened)).transition, "advance");

  const previous = process.env.FLOK_SPX402_SUBJECTS;
  process.env.FLOK_SPX402_SUBJECTS = JSON.stringify({
    "growthops/outbound": "9ABcdefghijk123456789ABCDEFGHJKLMNPQRSTUVWXY",
  });
  try {
    // Queued/persisted payload must still validate and classify against the
    // subject captured at create time, not the mutated env map.
    const emitResult = await emitOcEvidence(opened);
    assert.equal(emitResult.code, "upstream_decoder_unavailable");
    assert.notEqual(emitResult.code, "invalid_evidence");

    const retry = await persistOcEvidence(opened);
    assert.equal(retry.transition, "duplicate");
    assert.equal(retry.evidence.subject, SUBJECT);

    assert.equal(await classifyOcTransition(opened), "duplicate");
  } finally {
    process.env.FLOK_SPX402_SUBJECTS = previous;
  }
});
