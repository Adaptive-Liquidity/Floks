import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL("../migrations/0009_oc_evidence_v2_egress.sql", import.meta.url),
  "utf8",
);
const expiryMigration = await readFile(
  new URL("../migrations/0010_oc_expiry_quarantine.sql", import.meta.url),
  "utf8",
);
const expiryClaimsMigration = await readFile(
  new URL("../migrations/0011_oc_expiry_claims.sql", import.meta.url),
  "utf8",
);

test("0009 through 0011 upgrade bounded delivery and expiry quarantine", async () => {
  const db = new PGlite();
  await db.exec(`
    create table outcome_contracts (
      id text primary key,
      deadline timestamptz not null
    );
    create table oc_evidence_events (
      event_id text primary key,
      contract_id text not null
    );
    create table oc_evidence_outbox (
      event_id text primary key references oc_evidence_events (event_id) on delete cascade,
      payload jsonb not null,
      status text not null default 'pending' check (status in ('pending', 'sent')),
      attempts integer not null default 0 check (attempts >= 0),
      available_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      sent_at timestamptz
    );
    create table oc_lifecycle (
      contract_id text primary key,
      current_type text not null default 'OC_OPENED'
    );
    create index oc_evidence_outbox_pending_idx
      on oc_evidence_outbox (available_at, created_at)
      where status = 'pending';

    insert into outcome_contracts values
      ('contract-v1', '2026-08-25T00:00:00Z'),
      ('contract-v2', '2026-08-26T00:00:00Z');
    insert into oc_evidence_events values
      ('event-v1', 'contract-v1'),
      ('event-v2', 'contract-v2'),
      ('event-orphan', 'contract-missing');
    insert into oc_evidence_outbox (event_id, payload) values
      ('event-v1', '{"schema":"flok.oc-evidence.v1"}'),
      ('event-v2', '{"schema":"flok.oc-evidence.v2"}'),
      ('event-orphan', '{"schema":"flok.oc-evidence.v2"}');
  `);

  await db.exec(migration);
  await db.exec(expiryMigration);
  await db.exec(expiryClaimsMigration);
  const rows = await db.query(
    "select event_id, status, deadline_at, claim_token from oc_evidence_outbox order by event_id",
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0]?.event_id, "event-v2");
  assert.equal(rows.rows[0]?.status, "pending");
  assert.equal(new Date(rows.rows[0]?.deadline_at).toISOString(), "2026-08-26T00:00:00.000Z");
  assert.equal(rows.rows[0]?.claim_token, null);
  const lifecycleColumns = await db.query(
    `select column_name
     from information_schema.columns
     where table_name = 'oc_lifecycle'`,
  );
  assert.equal(
    lifecycleColumns.rows.some((row) => row.column_name === "expiry_retry_at"),
    true,
  );
  assert.equal(
    lifecycleColumns.rows.some((row) => row.column_name === "expiry_last_error"),
    true,
  );
  assert.equal(
    lifecycleColumns.rows.some((row) => row.column_name === "expiry_attempts"),
    true,
  );
  assert.equal(
    lifecycleColumns.rows.some((row) => row.column_name === "expiry_dead_lettered_at"),
    true,
  );
  assert.equal(
    lifecycleColumns.rows.some((row) => row.column_name === "expiry_claim_token"),
    true,
  );
  assert.equal(
    lifecycleColumns.rows.some((row) => row.column_name === "expiry_claim_until"),
    true,
  );
  const indexes = await db.query(
    "select indexname from pg_indexes where tablename = 'oc_evidence_outbox'",
  );
  assert.equal(
    indexes.rows.some((row) => row.indexname === "oc_evidence_outbox_pending_idx"),
    false,
  );
  assert.equal(
    indexes.rows.some((row) => row.indexname === "oc_evidence_outbox_drain_idx"),
    true,
  );
  const sweepIndexes = await db.query(
    `select indexname
     from pg_indexes
     where indexname in ('oc_lifecycle_expiry_sweep_idx', 'outcome_contracts_deadline_idx')`,
  );
  assert.equal(sweepIndexes.rows.length, 2);

  await db.exec(
    "update oc_evidence_outbox set status = 'dead_letter', last_error = 'terminal' where event_id = 'event-v2'",
  );
  await assert.rejects(
    db.exec("update oc_evidence_outbox set status = 'unknown' where event_id = 'event-v2'"),
  );
  await db.close();
});
