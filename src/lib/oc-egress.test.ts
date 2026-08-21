import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { dbSource, getSql } from "./db.ts";
import {
  drainOcEvidenceOutbox,
  readOcEgressConfig,
  readOcOutboxStatus,
  requeueDeadLetters,
  sweepExpiredOutcomeContracts,
} from "./oc-egress.server.ts";
import { createOcEvidence, persistOcEvidence } from "./oc-evidence.server.ts";

const SUBJECT = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk";
process.env.FLOK_SPX402_SUBJECTS = JSON.stringify({ "growthops/outbound": SUBJECT });

beforeEach(async () => {
  if (dbSource !== "pglite") throw new Error("oc_egress_tests_require_pglite");
  const sql = await getSql();
  await sql.query("delete from oc_evidence_outbox");
  await sql.query("delete from oc_lifecycle");
  await sql.query("delete from oc_evidence_events");
  await sql.query("delete from outcome_contracts");
});

async function createContract(id: string, deadline: string) {
  const sql = await getSql();
  const suffix = id
    .replace(/[^a-z0-9]/gi, "")
    .padEnd(32, "0")
    .slice(0, 32);
  await sql.query(
    `insert into outcome_contracts (
       id, poster_user_id, poster, outcome_class, outcome_text, proof_requirements,
       deadline, bound, visibility, version, contract_hash
     ) values ($1, $2, $3, 'artifact', 'Produce a verifiable staging artifact.',
       '[]'::jsonb, $4, '{"amount":"1","currency":"USD"}'::jsonb,
       'public', 1, $5)
     on conflict (id) do nothing`,
    [id, `user-${id}`, `@poster_${suffix}`, deadline, `sha256:${suffix.padEnd(64, "0")}`],
  );
}

async function enqueueOpened(contractId: string, occurredAt: string) {
  const evidence = await createOcEvidence({
    handle: "growthops",
    contract_id: contractId,
    cluster_id: "cluster-7",
    cluster_slug: "outbound",
    type: "OC_OPENED",
    occurred_at: occurredAt,
    idempotency_key: "open-1",
  });
  assert.equal((await persistOcEvidence(evidence)).transition, "advance");
  return evidence;
}

async function enqueueAwarded(contractId: string, occurredAt: string) {
  const evidence = await createOcEvidence({
    handle: "growthops",
    contract_id: contractId,
    cluster_id: "cluster-7",
    cluster_slug: "outbound",
    type: "OC_AWARDED",
    occurred_at: occurredAt,
    idempotency_key: "award-1",
  });
  assert.equal((await persistOcEvidence(evidence)).transition, "advance");
  return evidence;
}

function stagingEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    FLOK_SPX402_EGRESS_MODE: "staging",
    FLOK_SPX402_STAGING_URL: "https://spx-staging.example",
    OC_INGEST_SECRET: "test-ingest-secret",
    ...overrides,
  };
}

test("staging egress requires explicit mode, URL, and secret", () => {
  assert.equal(readOcEgressConfig({}), null);
  assert.equal(
    readOcEgressConfig({
      FLOK_SPX402_STAGING_URL: "https://spx-staging.example",
      OC_INGEST_SECRET: "secret",
    }),
    null,
  );
  assert.equal(
    readOcEgressConfig({
      FLOK_SPX402_EGRESS_MODE: "staging",
      FLOK_SPX402_STAGING_URL: "http://spx-staging.example",
      OC_INGEST_SECRET: "secret",
    }),
    null,
  );
  assert.equal(
    readOcEgressConfig(stagingEnv())?.endpoint,
    "https://spx-staging.example/api/public/ingest-oc-evidence",
  );
  assert.equal(
    readOcEgressConfig(stagingEnv({ FLOK_SPX402_STAGING_URL: "https://spx.example/staging" })),
    null,
  );
  assert.equal(
    readOcEgressConfig(stagingEnv({ FLOK_SPX402_STAGING_URL: "https://spx.example" })),
    null,
  );
  assert.equal(readOcEgressConfig(stagingEnv({ FLOK_OC_DRAIN_BATCH_SIZE: "100" }))?.batchSize, 5);
});

test("drainer sends v2 with bearer auth and marks the row sent", async () => {
  const id = `contract-send-${crypto.randomUUID()}`;
  const deadline = "2026-08-25T19:00:00.000Z";
  await createContract(id, deadline);
  const opened = await enqueueOpened(id, "2026-08-21T19:00:00.000Z");
  const sql = await getSql();
  let request: { url: string; init?: RequestInit } | undefined;
  let leaseUntil: string | undefined;

  const result = await drainOcEvidenceOutbox({
    env: stagingEnv({ FLOK_OC_DRAIN_BATCH_SIZE: "100" }),
    now: () => new Date("2026-08-21T19:01:00.000Z"),
    fetcher: async (url, init) => {
      request = { url: String(url), init };
      const rows = await sql.query<{ available_at: unknown }>(
        "select available_at from oc_evidence_outbox where event_id = $1",
        [opened.event_id],
      );
      leaseUntil = new Date(String(rows[0]?.available_at)).toISOString();
      return Response.json({ ok: true, inserted: true }, { status: 201 });
    },
  });

  assert.equal(result.sent, 1);
  assert.equal(request?.url, "https://spx-staging.example/api/public/ingest-oc-evidence");
  assert.equal(
    new Headers(request?.init?.headers).get("authorization"),
    "Bearer test-ingest-secret",
  );
  assert.equal(request?.init?.redirect, "error");
  assert.equal(leaseUntil, "2026-08-21T19:06:00.000Z");
  const payload = JSON.parse(String(request?.init?.body)) as Record<string, unknown>;
  assert.equal(payload.schema, "flok.oc-evidence.v2");
  assert.equal(payload.deadline_at, deadline);
  assert.equal(payload.evidence_hash, opened.evidence_hash);

  const rows = await sql.query<{ status: string; attempts: number }>(
    "select status, attempts from oc_evidence_outbox where event_id = $1",
    [opened.event_id],
  );
  assert.deepEqual(rows[0], { status: "sent", attempts: 1 });
});

test("drainer releases unattempted claims when its time budget expires", async () => {
  const id = `contract-budget-${crypto.randomUUID()}`;
  await createContract(id, "2026-08-25T19:00:00.000Z");
  const evidence = await enqueueOpened(id, "2026-08-21T19:00:00.000Z");
  const startedAt = new Date("2026-08-21T19:01:00.000Z");
  const expiredAt = new Date("2026-08-21T19:02:01.000Z");
  let nowCalls = 0;
  let fetchCalls = 0;

  const result = await drainOcEvidenceOutbox({
    env: stagingEnv(),
    now: () => (nowCalls++ < 2 ? startedAt : expiredAt),
    fetcher: async () => {
      fetchCalls += 1;
      return Response.json({ ok: true });
    },
  });

  const sql = await getSql();
  const rows = await sql.query<{ status: string; attempts: number; claim_token: string | null }>(
    "select status, attempts, claim_token from oc_evidence_outbox where event_id = $1",
    [evidence.event_id],
  );
  assert.equal(fetchCalls, 0);
  assert.equal(result.claimed, 1);
  assert.equal(result.released, 1);
  assert.equal(rows[0]?.status, "pending");
  assert.equal(rows[0]?.attempts, 0);
  assert.equal(rows[0]?.claim_token, null);
});

test("drainer retries server failures and dead-letters terminal HTTP", async () => {
  const retryId = `contract-retry-${crypto.randomUUID()}`;
  await createContract(retryId, "2026-08-25T19:00:00.000Z");
  const retryEvidence = await enqueueOpened(retryId, "2026-08-21T19:00:00.000Z");
  const retry = await drainOcEvidenceOutbox({
    env: stagingEnv(),
    now: () => new Date("2026-08-21T19:01:00.000Z"),
    fetcher: async () => Response.json({ error: "internal_error" }, { status: 503 }),
  });
  assert.equal(retry.retried, 1);

  const terminalId = `contract-terminal-${crypto.randomUUID()}`;
  await createContract(terminalId, "2026-08-25T19:00:00.000Z");
  const terminalEvidence = await enqueueOpened(terminalId, "2026-08-21T19:02:00.000Z");
  const terminal = await drainOcEvidenceOutbox({
    env: stagingEnv(),
    now: () => new Date("2026-08-21T19:01:10.000Z"),
    fetcher: async () => Response.json({ error: "invalid_evidence" }, { status: 400 }),
  });
  assert.equal(terminal.deadLettered, 1);

  const sql = await getSql();
  const rows = await sql.query<{ event_id: string; status: string; last_error: string }>(
    `select event_id, status, last_error
     from oc_evidence_outbox where event_id in ($1, $2) order by event_id`,
    [retryEvidence.event_id, terminalEvidence.event_id],
  );
  assert.equal(rows.find((row) => row.event_id === retryEvidence.event_id)?.status, "pending");
  assert.deepEqual(
    rows.find((row) => row.event_id === terminalEvidence.event_id),
    {
      event_id: terminalEvidence.event_id,
      status: "dead_letter",
      last_error: "http_400",
    },
  );
});

test("drainer preserves per-contract lifecycle delivery order", async () => {
  const id = `contract-order-${crypto.randomUUID()}`;
  await createContract(id, "2026-08-25T19:00:00.000Z");
  const opened = await enqueueOpened(id, "2026-08-21T19:00:00.000Z");
  await drainOcEvidenceOutbox({
    env: stagingEnv(),
    now: () => new Date("2026-08-21T19:01:00.000Z"),
    fetcher: async () => Response.json({ error: "unavailable" }, { status: 503 }),
  });
  const awarded = await enqueueAwarded(id, "2026-08-21T19:01:05.000Z");
  let delivered = 0;
  const blocked = await drainOcEvidenceOutbox({
    env: stagingEnv(),
    now: () => new Date("2026-08-21T19:01:10.000Z"),
    fetcher: async () => {
      delivered += 1;
      return Response.json({ ok: true });
    },
  });
  assert.equal(blocked.claimed, 0);
  assert.equal(delivered, 0);

  await drainOcEvidenceOutbox({
    env: stagingEnv(),
    now: () => new Date("2026-08-21T19:01:31.000Z"),
    fetcher: async (_url, init) => {
      assert.equal(JSON.parse(String(init?.body)).event_id, opened.event_id);
      delivered += 1;
      return Response.json({ ok: true });
    },
  });
  await drainOcEvidenceOutbox({
    env: stagingEnv(),
    now: () => new Date("2026-08-21T19:01:32.000Z"),
    fetcher: async (_url, init) => {
      assert.equal(JSON.parse(String(init?.body)).event_id, awarded.event_id);
      delivered += 1;
      return Response.json({ ok: true });
    },
  });
  assert.equal(delivered, 2);
});

test("drainer retries auth failures and honors Retry-After", async () => {
  const authId = `contract-auth-${crypto.randomUUID()}`;
  await createContract(authId, "2026-08-25T19:00:00.000Z");
  const authEvidence = await enqueueOpened(authId, "2026-08-21T19:00:00.000Z");
  const authNow = new Date("2026-08-21T20:00:00.000Z");
  await drainOcEvidenceOutbox({
    env: stagingEnv({ FLOK_OC_DRAIN_BATCH_SIZE: "100" }),
    now: () => authNow,
    fetcher: async () => Response.json({ error: "unauthorized" }, { status: 401 }),
  });

  const rateId = `contract-rate-${crypto.randomUUID()}`;
  await createContract(rateId, "2026-08-25T19:00:00.000Z");
  const rateEvidence = await enqueueOpened(rateId, "2026-08-21T20:01:00.000Z");
  const rateNow = new Date("2026-08-21T20:02:00.000Z");
  await drainOcEvidenceOutbox({
    env: stagingEnv({ FLOK_OC_DRAIN_BATCH_SIZE: "100" }),
    now: () => rateNow,
    fetcher: async () =>
      Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "120" } }),
  });

  const sql = await getSql();
  const rows = await sql.query<{ event_id: string; status: string; available_at: unknown }>(
    `select event_id, status, available_at
     from oc_evidence_outbox where event_id in ($1, $2) order by event_id`,
    [authEvidence.event_id, rateEvidence.event_id],
  );
  assert.equal(rows.find((row) => row.event_id === authEvidence.event_id)?.status, "pending");
  const rateRow = rows.find((row) => row.event_id === rateEvidence.event_id);
  assert.equal(rateRow?.status, "pending");
  assert.equal(new Date(String(rateRow?.available_at)).toISOString(), "2026-08-21T20:04:00.000Z");
});

test("drainer caps Retry-After at the maximum backoff", async () => {
  const id = `contract-rate-cap-${crypto.randomUUID()}`;
  await createContract(id, "2026-08-25T19:00:00.000Z");
  const evidence = await enqueueOpened(id, "2026-08-21T20:10:00.000Z");
  const now = new Date("2026-08-21T20:11:00.000Z");
  await drainOcEvidenceOutbox({
    env: stagingEnv({ FLOK_OC_DRAIN_BATCH_SIZE: "100" }),
    now: () => now,
    fetcher: async () =>
      Response.json({ error: "unavailable" }, { status: 503, headers: { "retry-after": "7200" } }),
  });

  const sql = await getSql();
  const rows = await sql.query<{ available_at: unknown }>(
    "select available_at from oc_evidence_outbox where event_id = $1",
    [evidence.event_id],
  );
  assert.equal(new Date(String(rows[0]?.available_at)).toISOString(), "2026-08-21T21:11:00.000Z");
});

test("stale delivery cannot overwrite a reclaimed outbox row", async () => {
  const sql = await getSql();
  await sql.query(
    "update oc_evidence_outbox set status = 'sent', sent_at = now() where status in ('pending', 'sending')",
  );
  const id = `contract-stale-${crypto.randomUUID()}`;
  await createContract(id, "2026-08-25T19:00:00.000Z");
  const evidence = await enqueueOpened(id, "2026-08-21T20:20:00.000Z");
  const result = await drainOcEvidenceOutbox({
    env: stagingEnv({ FLOK_OC_DRAIN_BATCH_SIZE: "1" }),
    now: () => new Date("2026-08-21T20:21:00.000Z"),
    fetcher: async () => {
      await sql.query(
        "update oc_evidence_outbox set attempts = 1, claim_token = 'new-claim' where event_id = $1",
        [evidence.event_id],
      );
      return Response.json({ ok: true }, { status: 201 });
    },
  });

  assert.equal(result.sent, 0);
  const rows = await sql.query<{ status: string; attempts: number }>(
    "select status, attempts from oc_evidence_outbox where event_id = $1",
    [evidence.event_id],
  );
  assert.deepEqual(rows[0], { status: "sending", attempts: 1 });
});

test("stale failure is not counted or allowed to overwrite a new claim", async () => {
  const sql = await getSql();
  await sql.query(
    "update oc_evidence_outbox set status = 'sent', sent_at = now() where status in ('pending', 'sending')",
  );
  const id = `contract-stale-failure-${crypto.randomUUID()}`;
  await createContract(id, "2026-08-25T19:00:00.000Z");
  const evidence = await enqueueOpened(id, "2026-08-21T20:30:00.000Z");
  const result = await drainOcEvidenceOutbox({
    env: stagingEnv({ FLOK_OC_DRAIN_BATCH_SIZE: "1" }),
    now: () => new Date("2026-08-21T20:31:00.000Z"),
    fetcher: async () => {
      await sql.query(
        "update oc_evidence_outbox set attempts = 1, claim_token = 'new-claim' where event_id = $1",
        [evidence.event_id],
      );
      return Response.json({ error: "unavailable" }, { status: 503 });
    },
  });

  assert.equal(result.retried, 0);
  assert.equal(result.deadLettered, 0);
  const rows = await sql.query<{ status: string; attempts: number; claim_token: string }>(
    "select status, attempts, claim_token from oc_evidence_outbox where event_id = $1",
    [evidence.event_id],
  );
  assert.deepEqual(rows[0], { status: "sending", attempts: 1, claim_token: "new-claim" });
});

test("drainer cancels oversized upstream error bodies", async () => {
  const sql = await getSql();
  await sql.query(
    "update oc_evidence_outbox set status = 'sent', sent_at = now() where status in ('pending', 'sending')",
  );
  const id = `contract-large-error-${crypto.randomUUID()}`;
  await createContract(id, "2026-08-25T19:00:00.000Z");
  const evidence = await enqueueOpened(id, "2026-08-21T20:40:00.000Z");
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(5_000)));
    },
    cancel() {
      cancelled = true;
    },
  });
  await drainOcEvidenceOutbox({
    env: stagingEnv({ FLOK_OC_DRAIN_BATCH_SIZE: "1" }),
    now: () => new Date("2026-08-21T20:41:00.000Z"),
    fetcher: async () => new Response(body, { status: 404 }),
  });

  assert.equal(cancelled, true);
  const rows = await sql.query<{ status: string; last_error: string }>(
    "select status, last_error from oc_evidence_outbox where event_id = $1",
    [evidence.event_id],
  );
  assert.deepEqual(rows[0], { status: "dead_letter", last_error: "http_404" });
});

test("drainer retries 403 but treats 409 and 413 as terminal", async () => {
  const cases = [
    { status: 403, expected: "pending" },
    { status: 409, expected: "dead_letter" },
    { status: 413, expected: "dead_letter" },
  ] as const;
  const sql = await getSql();

  for (const [index, item] of cases.entries()) {
    const id = `contract-http-${item.status}-${crypto.randomUUID()}`;
    await createContract(id, "2026-08-25T19:00:00.000Z");
    const evidence = await enqueueOpened(id, `2026-08-21T22:0${index}:00.000Z`);
    await drainOcEvidenceOutbox({
      env: stagingEnv({ FLOK_OC_DRAIN_BATCH_SIZE: "100" }),
      now: () => new Date(`2026-08-21T22:0${index}:30.000Z`),
      fetcher: async () => Response.json({ error: `http_${item.status}` }, { status: item.status }),
    });
    const rows = await sql.query<{ status: string }>(
      "select status from oc_evidence_outbox where event_id = $1",
      [evidence.event_id],
    );
    assert.equal(rows[0]?.status, item.expected);
  }
});

test("subject_not_found is retryable then distinctly dead-lettered and requeueable", async () => {
  const id = `contract-subject-${crypto.randomUUID()}`;
  await createContract(id, "2026-08-25T19:00:00.000Z");
  const evidence = await enqueueOpened(id, "2026-08-21T21:00:00.000Z");
  const result = await drainOcEvidenceOutbox({
    env: stagingEnv({
      FLOK_OC_DRAIN_BATCH_SIZE: "100",
      FLOK_OC_DRAIN_MAX_ATTEMPTS: "1",
    }),
    now: () => new Date("2026-08-21T21:01:00.000Z"),
    fetcher: async () => Response.json({ error: "subject_not_found" }, { status: 404 }),
  });
  assert.ok(result.deadLettered >= 1);

  const sql = await getSql();
  const deadRows = await sql.query<{ status: string; last_error: string }>(
    "select status, last_error from oc_evidence_outbox where event_id = $1",
    [evidence.event_id],
  );
  assert.deepEqual(deadRows[0], { status: "dead_letter", last_error: "subject_not_found" });

  const requeued = await requeueDeadLetters({
    now: () => new Date("2026-08-21T21:02:00.000Z"),
    limit: 100,
  });
  assert.ok(requeued.eventIds.includes(evidence.event_id));
  const pendingRows = await sql.query<{ status: string; attempts: number }>(
    "select status, attempts from oc_evidence_outbox where event_id = $1",
    [evidence.event_id],
  );
  assert.deepEqual(pendingRows[0], { status: "pending", attempts: 0 });

  const status = await readOcOutboxStatus({
    now: () => new Date("2026-08-21T21:03:00.000Z"),
  });
  assert.ok(status.pending >= 1);
  assert.ok(status.lagSeconds >= 0);
});

test("expiry sweeper enqueues OC_FAILED for overdue open contracts", async () => {
  const id = `contract-expired-${crypto.randomUUID()}`;
  const malformedId = `contract-expired-malformed-${crypto.randomUUID()}`;
  await createContract(id, "2026-08-22T19:00:00.000Z");
  await createContract(malformedId, "2026-08-22T19:00:00.000Z");
  const opened = await enqueueOpened(id, "2026-08-21T19:00:00.000Z");
  const sql = await getSql();
  await sql.query(
    `insert into oc_evidence_events (
       event_id, idempotency_key, contract_id, cluster_id, cluster_slug,
       subject, type, occurred_at, evidence_hash, payload
     ) values ($1, 'malformed-open', $2, 'cluster-7', 'outbound',
       $3, 'OC_OPENED', '2026-08-21T19:00:00.000Z', $4, '{}'::jsonb)`,
    [`event-${crypto.randomUUID()}`, malformedId, SUBJECT, `sha256:${"0".repeat(64)}`],
  );
  const malformedEvents = await sql.query<{ event_id: string }>(
    "select event_id from oc_evidence_events where contract_id = $1",
    [malformedId],
  );
  await sql.query(
    `insert into oc_lifecycle (
       contract_id, latest_event_id, cluster_id, cluster_slug, subject,
       current_type, current_occurred_at
     ) values ($1, $2, 'cluster-7', 'outbound', $3, 'OC_OPENED',
       '2026-08-21T19:00:00.000Z')`,
    [malformedId, malformedEvents[0]?.event_id, SUBJECT],
  );

  const previousSubjects = process.env.FLOK_SPX402_SUBJECTS;
  delete process.env.FLOK_SPX402_SUBJECTS;
  const result = await sweepExpiredOutcomeContracts({
    now: () => new Date("2026-08-23T19:00:00.000Z"),
  }).finally(() => {
    if (previousSubjects === undefined) {
      delete process.env.FLOK_SPX402_SUBJECTS;
    } else {
      process.env.FLOK_SPX402_SUBJECTS = previousSubjects;
    }
  });
  assert.equal(result.scanned, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.errors, 1);

  const rows = await sql.query<{ current_type: string; subject: string; outbox: number }>(
    `select lifecycle.current_type,
       lifecycle.subject,
       (select count(*)::int from oc_evidence_outbox as outbox
        join oc_evidence_events as event using (event_id)
        where event.contract_id = lifecycle.contract_id) as outbox
     from oc_lifecycle as lifecycle where lifecycle.contract_id = $1`,
    [id],
  );
  assert.deepEqual(rows[0], { current_type: "OC_FAILED", subject: opened.subject, outbox: 2 });
  const quarantined = await sql.query<{
    expiry_retry_at: unknown;
    expiry_last_error: string;
    expiry_attempts: number;
  }>(
    `select expiry_retry_at, expiry_last_error, expiry_attempts
     from oc_lifecycle
     where contract_id = $1`,
    [malformedId],
  );
  assert.equal(
    new Date(String(quarantined[0]?.expiry_retry_at)).toISOString(),
    "2026-08-23T20:00:00.000Z",
  );
  assert.equal(quarantined[0]?.expiry_last_error, "invalid_oc_evidence");
  assert.equal(quarantined[0]?.expiry_attempts, 1);
  const secondFailure = await sweepExpiredOutcomeContracts({
    now: () => new Date("2026-08-23T20:00:00.000Z"),
  });
  assert.deepEqual(secondFailure, { scanned: 1, failed: 0, errors: 1 });
  const thirdFailure = await sweepExpiredOutcomeContracts({
    now: () => new Date("2026-08-23T21:00:00.000Z"),
  });
  assert.deepEqual(thirdFailure, { scanned: 1, failed: 0, errors: 1 });
  const deadLettered = await sql.query<{
    expiry_attempts: number;
    expiry_dead_lettered_at: unknown;
  }>(
    `select expiry_attempts, expiry_dead_lettered_at
     from oc_lifecycle
     where contract_id = $1`,
    [malformedId],
  );
  assert.equal(deadLettered[0]?.expiry_attempts, 3);
  assert.equal(
    new Date(String(deadLettered[0]?.expiry_dead_lettered_at)).toISOString(),
    "2026-08-23T21:00:00.000Z",
  );
  const noMoreRetries = await sweepExpiredOutcomeContracts({
    now: () => new Date("2026-08-23T22:00:00.000Z"),
  });
  assert.deepEqual(noMoreRetries, { scanned: 0, failed: 0, errors: 0 });
});
