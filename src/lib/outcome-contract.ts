import { z } from "zod";

export const CONTRACT_VERSION = 1 as const;
const invisibleUnicode = /[\p{Bidi_Control}\p{Default_Ignorable_Code_Point}]/u;

function hasUnsafeDisplayCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2060 && code <= 0x206f) ||
      invisibleUnicode.test(character)
    );
  });
}

function safeText(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform((value) => value.normalize("NFC"))
    .refine((value) => !hasUnsafeDisplayCharacter(value), "Text contains unsafe characters.");
}

export const outcomeContractInputSchema = z
  .object({
    outcomeClass: z.enum(["artifact", "dataset", "transaction", "attestation"]),
    outcome: safeText(10, 2_000),
    proofRequirements: z
      .array(
        z
          .object({
            verifier: z.enum(["hash", "capsule", "attested-third-party"]),
            requirement: safeText(1, 200),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    deadline: z
      .string()
      .datetime({ offset: true })
      .refine((value) => Date.parse(value) > Date.now(), "Deadline must be in the future."),
    bound: z
      .object({
        amount: z
          .string()
          .trim()
          .regex(/^(0|[1-9]\d*)(\.\d{1,6})?$/)
          .max(40),
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9]{2,12}$/),
      })
      .strict(),
    visibility: z.enum(["public", "unlisted"]).default("public"),
  })
  .strict();

export type OutcomeContractInput = z.infer<typeof outcomeContractInputSchema>;
export type OutcomeContractVisibility = OutcomeContractInput["visibility"];
export type OutcomeContractStatus = "open";

export type OutcomeContractHeader = {
  id: string;
  poster: string;
  outcomeClass: "artifact" | "dataset" | "transaction" | "attestation";
  outcome: string;
  proofRequirements: Array<{
    verifier: "hash" | "capsule" | "attested-third-party";
    requirement: string;
  }>;
  deadline: string;
  bound: { amount: string; currency: string };
  visibility: OutcomeContractVisibility;
  status: OutcomeContractStatus;
  version: number;
  hash: string;
  createdAt: string;
};
