import { z } from "zod";

export const OC_EVENT_TYPES = [
  "OC_OPENED",
  "OC_AWARDED",
  "OC_FULFILLED",
  "OC_FAILED",
  "OC_SLASHED",
] as const;

export type OcEventType = (typeof OC_EVENT_TYPES)[number];
export type OcSeverity = "info" | "critical" | "success";
export type OcTransition = "advance" | "duplicate" | "conflict" | "invalid";

const EVENT_SEVERITY: Record<OcEventType, OcSeverity> = {
  OC_OPENED: "info",
  OC_AWARDED: "info",
  OC_FULFILLED: "success",
  OC_FAILED: "critical",
  OC_SLASHED: "critical",
};

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const ocSubjectSchema = z
  .string()
  .trim()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,64}$/);

export const ocEvidenceInputSchema = z
  .object({
    handle: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    contract_id: identifierSchema,
    cluster_id: identifierSchema,
    cluster_slug: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type: z.enum(OC_EVENT_TYPES),
    occurred_at: z.iso.datetime({ offset: true }),
    idempotency_key: identifierSchema,
    capsule_id: identifierSchema.optional(),
  })
  .strict();

export type OcEvidenceInput = z.infer<typeof ocEvidenceInputSchema>;

export type OcEvidence = Readonly<
  OcEvidenceInput & {
    schema: "flok.oc-evidence.v1";
    event_id: string;
    category: "task_executor";
    subject: string;
    severity: OcSeverity;
    evidence_hash: string;
  }
>;

export function severityForOcEvent(type: OcEventType): OcSeverity {
  return EVENT_SEVERITY[type];
}

function isSameEvent(previous: OcEvidence, next: OcEvidence): boolean {
  return (
    previous.event_id === next.event_id &&
    previous.contract_id === next.contract_id &&
    previous.cluster_id === next.cluster_id &&
    previous.cluster_slug === next.cluster_slug &&
    previous.subject === next.subject &&
    previous.type === next.type &&
    previous.occurred_at === next.occurred_at &&
    previous.evidence_hash === next.evidence_hash &&
    previous.capsule_id === next.capsule_id
  );
}

export function classifyOcTransitionFromState(
  previous: OcEvidence | null,
  next: OcEvidence,
): OcTransition {
  if (previous === null) return next.type === "OC_OPENED" ? "advance" : "invalid";
  if (isSameEvent(previous, next)) return "duplicate";
  if (
    previous.event_id === next.event_id ||
    previous.contract_id !== next.contract_id ||
    previous.cluster_id !== next.cluster_id ||
    previous.cluster_slug !== next.cluster_slug ||
    previous.subject !== next.subject ||
    previous.type === next.type
  ) {
    return "conflict";
  }
  if (Date.parse(next.occurred_at) < Date.parse(previous.occurred_at)) return "invalid";
  if (previous.type === "OC_OPENED") return next.type === "OC_AWARDED" ? "advance" : "invalid";
  if (previous.type === "OC_AWARDED") {
    return next.type === "OC_FULFILLED" || next.type === "OC_FAILED" || next.type === "OC_SLASHED"
      ? "advance"
      : "invalid";
  }
  return "invalid";
}
