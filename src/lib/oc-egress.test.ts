import assert from "node:assert/strict";
import test from "node:test";
import { getSql } from "./db.ts";
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
       'public', 1, $5)`,
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
});

test("drainer sends v2 with bearer auth and marks the row sent", async () => {
  const id = `contract-send-${crypto.randomUUID()}`;
  const deadline = "2026-08-25T19:00:00.000Z";
  await createContract(id, deadline);
  const opened = await enqueueOpened(id, "2026-08-21T19:00:00.000Z");
  let request: { url: string; init?: RequestInit } | undefined;

  const result = await drainOcEvidenceOutbox({
    env: stagingEnv(),
    now: () => new Date("2026-08-21T19:01:00.000Z"),
    fetcher: async (url, init) => {
      request = { url: String(url), init };
      return Response.json({ ok: true, inserted: true }, { status: 201 });
    },
  });

  assert.equal(result.sent, 1);
  assert.equal(request?.url, "https://spx-staging.example/api/public/ingest-oc-evidence");
  assert.equal(
    new Headers(request?.init?.headers).get("authorization"),
    "Bearer test-ingest-secret",
  );
  const payload = JSON.parse(String(request?.init?.body)) as Record<string, unknown>;
  assert.equal(payload.schema, "flok.oc-evidence.v2");
  assert.equal(payload.deadline_at, deadline);
  assert.equal(payload.evidence_hash, opened.evidence_hash);

  const sql = await getSql();
  const rows = await sql.query<{ status: string; attempts: number }>(
    "select status, attempts from oc_evidence_outbox where event_id = $1",
    [opened.event_id],
  );
  assert.deepEqual(rows[0], { status: "sent", attempts: 1 });
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
  await createContract(id, "2026-08-22T19:00:00.000Z");
  await enqueueOpened(id, "2026-08-21T19:00:00.000Z");

  const result = await sweepExpiredOutcomeContracts({
    now: () => new Date("2026-08-23T19:00:00.000Z"),
  });
  assert.equal(result.scanned, 1);
  assert.equal(result.failed, 1);

  const sql = await getSql();
  const rows = await sql.query<{ current_type: string; outbox: number }>(
    `select lifecycle.current_type,
       (select count(*)::int from oc_evidence_outbox as outbox
        join oc_evidence_events as event using (event_id)
        where event.contract_id = lifecycle.contract_id) as outbox
     from oc_lifecycle as lifecycle where lifecycle.contract_id = $1`,
    [id],
  );
  assert.deepEqual(rows[0], { current_type: "OC_FAILED", outbox: 2 });
});
