import { randomUUID } from "node:crypto";
import { getSql, type Sql } from "./db.ts";
import {
  createOcEvidenceFromBoundSubject,
  persistOcEvidence,
  validateOcEvidence,
} from "./oc-evidence.server.ts";
import type { OcEvidence } from "./oc-evidence.ts";

const INGEST_PATH = "/api/public/ingest-oc-evidence";
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_MAX_ATTEMPTS = 5;
const MIN_CLAIM_LEASE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const CLAIM_LEASE_BUFFER_MS = 60_000;
const DRAIN_BUDGET_MS = 60_000;
const MAX_DRAIN_ROWS = 5;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const EXPIRY_RETRY_MS = 60 * 60 * 1000;
const EXPIRY_MAX_ATTEMPTS = 3;
const MAX_ERROR_BODY_BYTES = 4 * 1024;

type OutboxRow = {
  event_id: string;
  payload: OcEvidence | string;
  attempts: number;
  claim_token: string;
  created_at: unknown;
};

type ExpiredLifecycleRow = {
  contract_id: string;
  latest_event_id: string;
  payload: OcEvidence | string;
};

type OutboxStatusRow = {
  pending: number;
  sending: number;
  sent: number;
  dead_letter: number;
  oldest: unknown;
};

export type OcEgressConfig = Readonly<{
  endpoint: string;
  secret: string;
  batchSize: number;
  maxAttempts: number;
}>;

export type OcDrainResult = Readonly<{
  enabled: boolean;
  claimed: number;
  released: number;
  sent: number;
  retried: number;
  deadLettered: number;
  lagSeconds: number;
}>;

export type OcExpirySweepResult = Readonly<{
  scanned: number;
  failed: number;
  errors: number;
}>;

export type OcOutboxStatus = Readonly<{
  pending: number;
  sending: number;
  sent: number;
  deadLetter: number;
  lagSeconds: number;
}>;

export type OcDeadLetterRequeueResult = Readonly<{
  requeued: number;
  eventIds: readonly string[];
}>;

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

export function readOcEgressConfig(env: NodeJS.ProcessEnv = process.env): OcEgressConfig | null {
  if (env.FLOK_SPX402_EGRESS_MODE?.trim() !== "staging") return null;
  const rawBase = env.FLOK_SPX402_STAGING_URL?.trim();
  const secret = env.OC_INGEST_SECRET?.trim();
  if (!rawBase || !secret) return null;

  let base: URL;
  try {
    base = new URL(rawBase);
  } catch {
    return null;
  }
  const local = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  const stagingHost = /(^|[.-])staging([.-]|$)/i.test(base.hostname);
  if (
    (base.protocol !== "https:" && !(local && base.protocol === "http:")) ||
    (!local && !stagingHost) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/"
  ) {
    return null;
  }

  return Object.freeze({
    endpoint: new URL(INGEST_PATH, `${base.origin}/`).toString(),
    secret,
    batchSize: boundedInteger(env.FLOK_OC_DRAIN_BATCH_SIZE, DEFAULT_BATCH_SIZE, MAX_DRAIN_ROWS),
    maxAttempts: boundedInteger(env.FLOK_OC_DRAIN_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 20),
  });
}

function parsePayload(payload: OcEvidence | string): OcEvidence {
  return (typeof payload === "string" ? JSON.parse(payload) : payload) as OcEvidence;
}

function expiryErrorCode(error: unknown): string {
  const errorName =
    typeof error === "object" && error !== null && "name" in error ? error.name : undefined;
  if (error instanceof SyntaxError || errorName === "ZodError") return "invalid_oc_evidence";
  if (
    error instanceof Error &&
    ["invalid_oc_deadline", "outcome_contract_not_found", "oc_deadline_mismatch"].includes(
      error.message,
    )
  ) {
    return error.message;
  }
  return "expiry_processing_failed";
}

function retryableStatus(status: number): boolean {
  return (
    status === 401 ||
    status === 403 ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, 30_000 * 2 ** Math.max(0, attempts - 1));
}

function retryAfterMs(response: Response, now: Date): number | undefined {
  if (response.status !== 429 && response.status !== 503) return undefined;
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_BACKOFF_MS, seconds * 1000);
  }
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt)
    ? Math.min(MAX_BACKOFF_MS, Math.max(0, retryAt - now.getTime()))
    : undefined;
}

async function responseErrorCode(response: Response): Promise<string | undefined> {
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_ERROR_BODY_BYTES) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (typeof body !== "object" || body === null) return undefined;
    const value = "code" in body ? body.code : "error" in body ? body.error : undefined;
    return typeof value === "string" ? value : undefined;
  } catch {
    await reader.cancel().catch(() => undefined);
    return undefined;
  }
}

async function claimOutbox(sql: Sql, config: OcEgressConfig, now: Date): Promise<OutboxRow[]> {
  const claimLimit = Math.min(config.batchSize, MAX_DRAIN_ROWS);
  const leaseMs = Math.max(
    MIN_CLAIM_LEASE_MS,
    claimLimit * REQUEST_TIMEOUT_MS + CLAIM_LEASE_BUFFER_MS,
  );
  const leaseUntil = new Date(now.getTime() + leaseMs).toISOString();
  const claimToken = randomUUID();
  return sql.transaction((tx) =>
    tx.query<OutboxRow>(
      `with candidates as (
         select candidate.event_id
         from oc_evidence_outbox as candidate
         join oc_evidence_events as current_event
           on current_event.event_id = candidate.event_id
         where candidate.status in ('pending', 'sending')
           and candidate.available_at <= $1
           and not exists (
             select 1
             from oc_evidence_outbox as predecessor
             join oc_evidence_events as predecessor_event
               on predecessor_event.event_id = predecessor.event_id
             where predecessor_event.contract_id = current_event.contract_id
               and predecessor.status <> 'sent'
               and (
                 predecessor_event.occurred_at < current_event.occurred_at
                 or (
                   predecessor_event.occurred_at = current_event.occurred_at
                   and (
                     case predecessor_event.type
                       when 'OC_OPENED' then 1
                       when 'OC_AWARDED' then 2
                       else 3
                     end
                   ) < (
                     case current_event.type
                       when 'OC_OPENED' then 1
                       when 'OC_AWARDED' then 2
                       else 3
                     end
                   )
                 )
                 or (
                   predecessor_event.occurred_at = current_event.occurred_at
                   and predecessor_event.type = current_event.type
                   and predecessor.event_id < candidate.event_id
                 )
               )
           )
         order by candidate.available_at, candidate.created_at
         for update of candidate skip locked
         limit $2
       )
       update oc_evidence_outbox as outbox
       set status = 'sending',
           attempts = outbox.attempts + 1,
           available_at = $3,
           claim_token = $4,
           last_error = null
       from candidates
       where outbox.event_id = candidates.event_id
       returning outbox.event_id, outbox.payload, outbox.attempts,
         outbox.claim_token, outbox.created_at`,
      [now.toISOString(), claimLimit, leaseUntil, claimToken],
    ),
  );
}

async function releaseClaim(sql: Sql, row: OutboxRow, now: Date): Promise<boolean> {
  const updated = await sql.query<{ event_id: string }>(
    `update oc_evidence_outbox
     set status = 'pending',
         attempts = greatest(0, attempts - 1),
         available_at = $2,
         claim_token = null
     where event_id = $1 and status = 'sending' and claim_token = $3
     returning event_id`,
    [row.event_id, now.toISOString(), row.claim_token],
  );
  return updated.length === 1;
}

async function markSent(sql: Sql, row: OutboxRow, now: Date): Promise<boolean> {
  const updated = await sql.query<{ event_id: string }>(
    `update oc_evidence_outbox
     set status = 'sent', sent_at = $2, available_at = $2, claim_token = null, last_error = null
     where event_id = $1 and status = 'sending' and claim_token = $3
     returning event_id`,
    [row.event_id, now.toISOString(), row.claim_token],
  );
  if (updated.length === 0) {
    console.warn(
      JSON.stringify({ metric: "flok.oc_evidence_outbox.stale_claim", event_id: row.event_id }),
    );
  }
  return updated.length === 1;
}

async function markFailed(
  sql: Sql,
  row: OutboxRow,
  terminal: boolean,
  error: string,
  config: OcEgressConfig,
  now: Date,
  retryDelayMs?: number,
): Promise<"retried" | "dead_letter" | "stale"> {
  if (terminal || row.attempts >= config.maxAttempts) {
    const updated = await sql.query<{ event_id: string }>(
      `update oc_evidence_outbox
       set status = 'dead_letter', dead_lettered_at = $2, available_at = $2,
           claim_token = null, last_error = $3
       where event_id = $1 and status = 'sending' and claim_token = $4
       returning event_id`,
      [row.event_id, now.toISOString(), error.slice(0, 500), row.claim_token],
    );
    if (updated.length === 0) {
      console.warn(
        JSON.stringify({ metric: "flok.oc_evidence_outbox.stale_claim", event_id: row.event_id }),
      );
    }
    return updated.length === 1 ? "dead_letter" : "stale";
  }
  const delayMs = Math.min(MAX_BACKOFF_MS, Math.max(backoffMs(row.attempts), retryDelayMs ?? 0));
  const availableAt = new Date(now.getTime() + delayMs).toISOString();
  const updated = await sql.query<{ event_id: string }>(
    `update oc_evidence_outbox
     set status = 'pending', available_at = $2, claim_token = null, last_error = $3
     where event_id = $1 and status = 'sending' and claim_token = $4
     returning event_id`,
    [row.event_id, availableAt, error.slice(0, 500), row.claim_token],
  );
  if (updated.length === 0) {
    console.warn(
      JSON.stringify({ metric: "flok.oc_evidence_outbox.stale_claim", event_id: row.event_id }),
    );
  }
  return updated.length === 1 ? "retried" : "stale";
}

async function readDrainLagSeconds(sql: Sql, now: Date): Promise<number> {
  const rows = await sql.query<{ oldest: unknown }>(
    "select min(created_at) as oldest from oc_evidence_outbox where status in ('pending', 'sending')",
  );
  const oldest = rows[0]?.oldest;
  if (oldest === null || oldest === undefined) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(String(oldest)).getTime()) / 1000));
}

export async function readOcOutboxStatus(
  options: { sqlPromise?: Promise<Sql>; now?: () => Date } = {},
): Promise<OcOutboxStatus> {
  const sql = await (options.sqlPromise ?? getSql());
  const now = options.now?.() ?? new Date();
  const rows = await sql.query<OutboxStatusRow>(
    `select
       count(*) filter (where status = 'pending')::int as pending,
       count(*) filter (where status = 'sending')::int as sending,
       count(*) filter (where status = 'sent')::int as sent,
       count(*) filter (where status = 'dead_letter')::int as dead_letter,
       min(created_at) filter (where status in ('pending', 'sending')) as oldest
     from oc_evidence_outbox`,
  );
  const row = rows[0];
  const oldest = row?.oldest;
  const lagSeconds =
    oldest === null || oldest === undefined
      ? 0
      : Math.max(0, Math.floor((now.getTime() - new Date(String(oldest)).getTime()) / 1000));
  return Object.freeze({
    pending: row?.pending ?? 0,
    sending: row?.sending ?? 0,
    sent: row?.sent ?? 0,
    deadLetter: row?.dead_letter ?? 0,
    lagSeconds,
  });
}

export async function requeueDeadLetters(
  options: { sqlPromise?: Promise<Sql>; now?: () => Date; limit?: number } = {},
): Promise<OcDeadLetterRequeueResult> {
  const sql = await (options.sqlPromise ?? getSql());
  const now = options.now?.() ?? new Date();
  const limit = Math.min(100, Math.max(1, options.limit ?? DEFAULT_BATCH_SIZE));
  const rows = await sql.transaction((tx) =>
    tx.query<{ event_id: string }>(
      `with candidates as (
         select event_id
         from oc_evidence_outbox
         where status = 'dead_letter'
         order by dead_lettered_at, created_at
         for update skip locked
         limit $1
       )
       update oc_evidence_outbox as outbox
       set status = 'pending',
           attempts = 0,
           available_at = $2,
           claim_token = null,
           last_error = null,
           dead_lettered_at = null,
           sent_at = null
       from candidates
       where outbox.event_id = candidates.event_id
       returning outbox.event_id`,
      [limit, now.toISOString()],
    ),
  );
  return Object.freeze({
    requeued: rows.length,
    eventIds: Object.freeze(rows.map((row) => row.event_id)),
  });
}

export async function drainOcEvidenceOutbox(
  options: {
    sqlPromise?: Promise<Sql>;
    fetcher?: typeof fetch;
    now?: () => Date;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<OcDrainResult> {
  const config = readOcEgressConfig(options.env);
  if (!config) {
    return Object.freeze({
      enabled: false,
      claimed: 0,
      released: 0,
      sent: 0,
      retried: 0,
      deadLettered: 0,
      lagSeconds: 0,
    });
  }

  const sql = await (options.sqlPromise ?? getSql());
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());
  const rows = await claimOutbox(sql, config, now());
  let sent = 0;
  let retried = 0;
  let deadLettered = 0;
  let released = 0;
  const drainDeadline = now().getTime() + DRAIN_BUDGET_MS;

  for (const [index, row] of rows.entries()) {
    if (now().getTime() >= drainDeadline) {
      for (const remaining of rows.slice(index)) {
        if (await releaseClaim(sql, remaining, now())) released += 1;
      }
      break;
    }
    let payload: OcEvidence;
    try {
      payload = await validateOcEvidence(parsePayload(row.payload));
    } catch {
      const disposition = await markFailed(sql, row, true, "invalid_evidence", config, now());
      if (disposition === "dead_letter") deadLettered += 1;
      continue;
    }
    try {
      const response = await fetcher(config.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) {
        await response.body?.cancel().catch(() => undefined);
        if (await markSent(sql, row, now())) sent += 1;
        continue;
      }
      const upstreamCode = await responseErrorCode(response);
      const subjectNotFound = response.status === 404 && upstreamCode === "subject_not_found";
      const failureTime = now();
      const disposition = await markFailed(
        sql,
        row,
        !(subjectNotFound || retryableStatus(response.status)),
        subjectNotFound ? "subject_not_found" : `http_${response.status}`,
        config,
        failureTime,
        retryAfterMs(response, failureTime),
      );
      if (disposition === "retried") retried += 1;
      else if (disposition === "dead_letter") deadLettered += 1;
    } catch (error) {
      const disposition = await markFailed(
        sql,
        row,
        false,
        error instanceof Error ? error.name : "network_error",
        config,
        now(),
      );
      if (disposition === "retried") retried += 1;
      else if (disposition === "dead_letter") deadLettered += 1;
    }
  }

  const lagSeconds = await readDrainLagSeconds(sql, now());
  console.info(
    JSON.stringify({
      metric: "flok.oc_evidence_outbox.drain_lag_seconds",
      value: lagSeconds,
      claimed: rows.length,
      released,
      sent,
      retried,
      dead_lettered: deadLettered,
    }),
  );
  return Object.freeze({
    enabled: true,
    claimed: rows.length,
    released,
    sent,
    retried,
    deadLettered,
    lagSeconds,
  });
}

export async function sweepExpiredOutcomeContracts(
  options: {
    sqlPromise?: Promise<Sql>;
    now?: () => Date;
    limit?: number;
  } = {},
): Promise<OcExpirySweepResult> {
  const sqlPromise = options.sqlPromise ?? getSql();
  const sql = await sqlPromise;
  const now = options.now?.() ?? new Date();
  const limit = Math.min(100, Math.max(1, options.limit ?? DEFAULT_BATCH_SIZE));
  const rows = await sql.query<ExpiredLifecycleRow>(
    `select contract.id as contract_id,
            lifecycle.latest_event_id,
            event.payload
     from outcome_contracts as contract
     join oc_lifecycle as lifecycle on lifecycle.contract_id = contract.id
     join oc_evidence_events as event on event.event_id = lifecycle.latest_event_id
     where contract.deadline <= $1
       and lifecycle.current_type in ('OC_OPENED', 'OC_AWARDED')
       and (lifecycle.expiry_retry_at is null or lifecycle.expiry_retry_at <= $1)
       and lifecycle.expiry_dead_lettered_at is null
     order by contract.deadline, contract.id
     limit $2`,
    [now.toISOString(), limit],
  );
  let failed = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const previous = parsePayload(row.payload);
      const evidence = await createOcEvidenceFromBoundSubject(
        {
          handle: previous.handle,
          contract_id: previous.contract_id,
          cluster_id: previous.cluster_id,
          cluster_slug: previous.cluster_slug,
          type: "OC_FAILED",
          occurred_at: now.toISOString(),
          idempotency_key: "deadline-expired-v1",
        },
        previous.subject,
      );
      if ((await persistOcEvidence(evidence, {}, sqlPromise)).transition === "advance") failed += 1;
    } catch (error) {
      errors += 1;
      const errorCode = expiryErrorCode(error);
      try {
        await sql.query(
          `update oc_lifecycle
           set expiry_attempts = expiry_attempts + 1,
               expiry_retry_at = case
                 when expiry_attempts + 1 >= $5 then null
                 else $3::timestamptz
               end,
               expiry_last_error = $4,
               expiry_dead_lettered_at = case
                 when expiry_attempts + 1 >= $5 then $6::timestamptz
                 else null
               end
           where contract_id = $1 and latest_event_id = $2`,
          [
            row.contract_id,
            row.latest_event_id,
            new Date(now.getTime() + EXPIRY_RETRY_MS).toISOString(),
            errorCode,
            EXPIRY_MAX_ATTEMPTS,
            now.toISOString(),
          ],
        );
      } catch (quarantineError) {
        console.warn(
          JSON.stringify({
            metric: "flok.oc_evidence_expiry.quarantine_error",
            contract_id: row.contract_id,
            error: quarantineError instanceof Error ? quarantineError.name : "unknown",
          }),
        );
      }
      console.warn(
        JSON.stringify({
          metric: "flok.oc_evidence_expiry.sweep_error",
          contract_id: row.contract_id,
          error: errorCode,
        }),
      );
    }
  }
  return Object.freeze({ scanned: rows.length, failed, errors });
}
