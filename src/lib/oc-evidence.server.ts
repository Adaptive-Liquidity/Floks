import type { OcEvidence } from "@/lib/oc-evidence";

export const OC_DECODER_STATUS = Object.freeze({
  category: "task_executor",
  decoderLive: false,
  reason: "upstream_decoder_unavailable",
} as const);

export type OcEvidenceEmissionResult = {
  ok: false;
  code: typeof OC_DECODER_STATUS.reason;
  decoderLive: false;
};

/**
 * S2 fail-closed boundary. Upstream has no OC_* ingestion contract or live
 * task_executor decoder yet, so callers can construct evidence without
 * accidentally publishing it to an unverified sink.
 */
export function emitOcEvidence(_evidence: OcEvidence): Promise<OcEvidenceEmissionResult> {
  return Promise.resolve(
    Object.freeze({
      ok: false,
      code: OC_DECODER_STATUS.reason,
      decoderLive: OC_DECODER_STATUS.decoderLive,
    }),
  );
}
