import { getSql, type Sql } from "./db.ts";
import { canonicalJsonStringify, sha256Hex } from "./evidence-hash.server.ts";
import {
  classifyOcTransitionFromState,
  ocEvidenceInputSchema,
  ocSubjectSchema,
  severityForOcEvent,
  type OcEvidence,
  type OcTransition,
} from "./oc-evidence.ts";
import { parseSubjectMap, resolveSubject } from "./spx-subject.ts";

export const OC_DECODER_STATUS = Object.freeze({
  category: "task_executor",
  decoderLive: false,
  reason: "upstream_decoder_unavailable",
} as const);

export type OcDecoderStatus = {
  category: "task_executor";
  decoderLive: boolean;
  reason: "upstream_decoder_unavailable" | "upstream_decoder_live" | "probe_failed";
};

export async function createOcEvidence(input: unknown): Promise<OcEvidence> {
  const parsed = ocEvidenceInputSchema.parse(input);
  const subject = ocSubjectSchema.parse(
    resolveSubject(
      parseSubjectMap(process.env.FLOK_SPX402_SUBJECTS),
      parsed.handle,
      parsed.cluster_slug,
    ),
  );
  const eventId = `oc_${await sha256Hex(
    canonicalJsonStringify({
      contract_id: parsed.contract_id,
      type: parsed.type,
      idempotency_key: parsed.idempotency_key,
    }),
  )}`;
  const hashPayload = {
    ...parsed,
    schema: "flok.oc-evidence.v1" as const,
    event_id: eventId,
    category: "task_executor" as const,
    subject,
    severity: severityForOcEvent(parsed.type),
  };
  return Object.freeze({
    ...hashPayload,
    evidence_hash: `sha256:${await sha256Hex(canonicalJsonStringify(hashPayload))}`,
  });
}

async function validateOcEvidence(value: unknown): Promise<OcEvidence> {
  if (typeof value !== "object" || value === null) throw new Error("invalid_oc_evidence");
  const evidence = value as Partial<OcEvidence>;
  const expected = await createOcEvidence({
    handle: evidence.handle,
    contract_id: evidence.contract_id,
    cluster_id: evidence.cluster_id,
    cluster_slug: evidence.cluster_slug,
    type: evidence.type,
    occurred_at: evidence.occurred_at,
    idempotency_key: evidence.idempotency_key,
    ...(evidence.capsule_id === undefined ? {} : { capsule_id: evidence.capsule_id }),
  });
  if (canonicalJsonStringify(expected) !== canonicalJsonStringify(value)) {
    throw new Error("invalid_oc_evidence");
  }
  return expected;
}

export async function probeDecoderStatus(
  readStatus?: () => Promise<unknown>,
): Promise<Readonly<OcDecoderStatus>> {
  if (!readStatus) return OC_DECODER_STATUS;
  try {
    const value = await readStatus();
    if (
      typeof value === "object" &&
      value !== null &&
      "category" in value &&
      value.category === "task_executor" &&
      "decoderLive" in value &&
      value.decoderLive === true
    ) {
      return Object.freeze({
        category: "task_executor",
        decoderLive: true,
        reason: "upstream_decoder_live",
      });
    }
    return OC_DECODER_STATUS;
  } catch {
    return Object.freeze({
      category: "task_executor",
      decoderLive: false,
      reason: "probe_failed",
    });
  }
}

export type OcEvidenceEmissionResult = {
  ok: false;
  code:
    | "invalid_evidence"
    | "upstream_decoder_unavailable"
    | "ingestion_contract_unavailable"
    | "probe_failed";
  decoderLive: boolean;
};

/**
 * Gate 1 has no authenticated upstream ingestion contract. Even if a probe
 * observes a decoder, this boundary remains closed until that contract ships.
 */
export async function emitOcEvidence(
  evidence: unknown,
  readStatus?: () => Promise<unknown>,
): Promise<Readonly<OcEvidenceEmissionResult>> {
  try {
    await validateOcEvidence(evidence);
  } catch {
    return Object.freeze({
      ok: false,
      code: "invalid_evidence",
      decoderLive: false,
    });
  }
  const status = await probeDecoderStatus(readStatus);
  return Object.freeze({
    ok: false,
    code:
      status.reason === "probe_failed"
        ? "probe_failed"
        : status.decoderLive
          ? "ingestion_contract_unavailable"
          : "upstream_decoder_unavailable",
    decoderLive: status.decoderLive,
  });
}

export type PersistOcEvidenceResult = Readonly<{
  transition: OcTransition;
  evidence: OcEvidence;
}>;

type PersistHooks = {
  beforeOutboxInsert?: () => void | Promise<void>;
};

type EventRow = { payload: OcEvidence | string };
type LifecycleRow = { latest_event_id: string | null };

function parseStoredEvidence(row: EventRow | undefined): OcEvidence | null {
  if (!row) return null;
  return (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) as OcEvidence;
}

async function classifyPersistedTransition(
  tx: Sql,
  evidence: OcEvidence,
): Promise<{ transition: OcTransition; lifecycle: LifecycleRow }> {
  await tx.query(
    "insert into oc_lifecycle (contract_id) values ($1) on conflict (contract_id) do nothing",
    [evidence.contract_id],
  );
  const lifecycleRows = await tx.query<LifecycleRow>(
    "select latest_event_id from oc_lifecycle where contract_id = $1 for update",
    [evidence.contract_id],
  );
  const lifecycle = lifecycleRows[0];
  if (!lifecycle) throw new Error("oc_lifecycle_lock_failed");

  const existingRows = await tx.query<EventRow>(
    "select payload from oc_evidence_events where event_id = $1 or (contract_id = $2 and type = $3 and idempotency_key = $4) limit 1",
    [evidence.event_id, evidence.contract_id, evidence.type, evidence.idempotency_key],
  );
  const existing = parseStoredEvidence(existingRows[0]);
  if (existing) {
    return {
      transition: classifyOcTransitionFromState(existing, evidence),
      lifecycle,
    };
  }

  const previousRows = lifecycle.latest_event_id
    ? await tx.query<EventRow>("select payload from oc_evidence_events where event_id = $1", [
        lifecycle.latest_event_id,
      ])
    : [];
  return {
    transition: classifyOcTransitionFromState(parseStoredEvidence(previousRows[0]), evidence),
    lifecycle,
  };
}

export async function classifyOcTransition(
  evidence: unknown,
  sqlPromise?: Promise<Sql>,
): Promise<OcTransition> {
  const validated = await validateOcEvidence(evidence);
  const sql = await (sqlPromise ?? getSql());
  return sql.transaction(async (tx) => {
    const { transition, lifecycle } = await classifyPersistedTransition(tx, validated);
    if (!lifecycle.latest_event_id) {
      await tx.query(
        "delete from oc_lifecycle where contract_id = $1 and latest_event_id is null",
        [validated.contract_id],
      );
    }
    return transition;
  });
}

export async function persistOcEvidence(
  evidence: unknown,
  hooks: PersistHooks = {},
  sqlPromise?: Promise<Sql>,
): Promise<PersistOcEvidenceResult> {
  const validated = await validateOcEvidence(evidence);
  const sql = await (sqlPromise ?? getSql());
  return sql.transaction(async (tx) => {
    const { transition, lifecycle } = await classifyPersistedTransition(tx, validated);
    if (transition !== "advance") {
      if (!lifecycle.latest_event_id) {
        await tx.query(
          "delete from oc_lifecycle where contract_id = $1 and latest_event_id is null",
          [validated.contract_id],
        );
      }
      return Object.freeze({ transition, evidence: validated });
    }

    const payload = JSON.stringify(validated);
    await tx.query(
      `insert into oc_evidence_events (
        event_id, idempotency_key, contract_id, cluster_id, cluster_slug,
        subject, type, occurred_at, evidence_hash, capsule_id, payload
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        validated.event_id,
        validated.idempotency_key,
        validated.contract_id,
        validated.cluster_id,
        validated.cluster_slug,
        validated.subject,
        validated.type,
        validated.occurred_at,
        validated.evidence_hash,
        validated.capsule_id ?? null,
        payload,
      ],
    );
    await hooks.beforeOutboxInsert?.();
    await tx.query("insert into oc_evidence_outbox (event_id, payload) values ($1, $2::jsonb)", [
      validated.event_id,
      payload,
    ]);
    await tx.query(
      `update oc_lifecycle set
        latest_event_id = $2, cluster_id = $3, cluster_slug = $4, subject = $5,
        current_type = $6, current_occurred_at = $7, updated_at = now()
      where contract_id = $1`,
      [
        validated.contract_id,
        validated.event_id,
        validated.cluster_id,
        validated.cluster_slug,
        validated.subject,
        validated.type,
        validated.occurred_at,
      ],
    );
    return Object.freeze({ transition, evidence: validated });
  });
}
