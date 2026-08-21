import { createHmac, randomBytes } from "node:crypto";
import { getSql } from "./db.ts";
import { canonicalJsonStringify, sha256Hex } from "./evidence-hash.server.ts";
import { newId } from "./ids.ts";
import { CONTRACT_VERSION } from "./outcome-contract.ts";
import { toIso } from "./time.ts";
import type {
  OutcomeContractHeader,
  OutcomeContractInput,
  OutcomeContractStatus,
  OutcomeContractVisibility,
} from "./outcome-contract.ts";

type OutcomeContractRow = {
  id: string;
  poster: string;
  outcome_class: OutcomeContractHeader["outcomeClass"];
  outcome_text: string;
  proof_requirements: unknown;
  deadline: unknown;
  bound: unknown;
  visibility: OutcomeContractVisibility;
  status: OutcomeContractStatus;
  version: number;
  contract_hash: string;
  created_at: unknown;
};

const globalPosterSecret = globalThis as typeof globalThis & {
  __flokPosterSecret__?: string;
};

function posterSecret(): string {
  const configured = process.env.FLOK_POSTER_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production" || process.env.DATABASE_URL?.trim()) {
    throw new Error("FLOK_POSTER_SECRET is required for persistent Outcome Contracts.");
  }
  globalPosterSecret.__flokPosterSecret__ ??= randomBytes(32).toString("hex");
  return globalPosterSecret.__flokPosterSecret__;
}

function posterPseudonym(posterUserId: string): string {
  // A secret-keyed 128-bit id prevents offline user-id enumeration and makes
  // accidental public-poster collisions impractical.
  const digest = createHmac("sha256", posterSecret())
    .update("flok:outcome-contract-poster:v1\0")
    .update(posterUserId)
    .digest("hex");
  return `@poster_${digest.slice(0, 32)}`;
}

function parseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function mapHeader(row: OutcomeContractRow): OutcomeContractHeader {
  return {
    id: row.id,
    poster: row.poster,
    outcomeClass: row.outcome_class,
    outcome: row.outcome_text,
    proofRequirements: parseJson<OutcomeContractHeader["proofRequirements"]>(
      row.proof_requirements,
    ),
    deadline: toIso(row.deadline) ?? "",
    bound: parseJson<{ amount: string; currency: string }>(row.bound),
    visibility: row.visibility,
    status: row.status,
    version: Number(row.version),
    hash: row.contract_hash,
    createdAt: toIso(row.created_at) ?? "",
  };
}

const HEADER_COLUMNS = `
  id, poster, outcome_class, outcome_text, proof_requirements, deadline, bound,
  visibility, status, version, contract_hash, created_at
`;

export class ContractLimitError extends Error {
  constructor() {
    super("contract_limit_reached");
    this.name = "ContractLimitError";
  }
}

export async function createOutcomeContract(
  posterUserId: string,
  input: OutcomeContractInput,
): Promise<OutcomeContractHeader> {
  const sql = await getSql();
  const id = newId();
  const poster = posterPseudonym(posterUserId);
  const deadline = new Date(input.deadline).toISOString();
  const immutableHeader = {
    id,
    poster,
    outcomeClass: input.outcomeClass,
    outcome: input.outcome,
    proofRequirements: input.proofRequirements,
    deadline,
    bound: input.bound,
    visibility: input.visibility,
    version: CONTRACT_VERSION,
  };
  const hash = `sha256:${await sha256Hex(canonicalJsonStringify(immutableHeader))}`;
  return sql.transaction(async (tx) => {
    const quota = await tx.query<{ contract_count: number }>(
      `insert into outcome_contract_poster_quotas (poster_user_id, poster, contract_count)
       values ($1, $2, 1)
       on conflict (poster_user_id) do update
       set contract_count = outcome_contract_poster_quotas.contract_count + 1
       where outcome_contract_poster_quotas.contract_count < 100
       returning contract_count`,
      [posterUserId, poster],
    );
    if (!quota[0]) throw new ContractLimitError();

    const rows = await tx.query<OutcomeContractRow>(
      `insert into outcome_contracts (
         id, poster_user_id, poster, outcome_class, outcome_text, proof_requirements,
         deadline, bound, visibility, version, contract_hash
       ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9, $10, $11)
       returning ${HEADER_COLUMNS}`,
      [
        id,
        posterUserId,
        poster,
        input.outcomeClass,
        input.outcome,
        JSON.stringify(input.proofRequirements),
        deadline,
        JSON.stringify(input.bound),
        input.visibility,
        CONTRACT_VERSION,
        hash,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error("outcome_contract_insert_failed");
    return mapHeader(row);
  });
}

export async function getPublicOutcomeContract(id: string): Promise<OutcomeContractHeader | null> {
  const sql = await getSql();
  const rows = await sql.query<OutcomeContractRow>(
    `select ${HEADER_COLUMNS}
     from outcome_contracts
     where id = $1 and visibility in ('public', 'unlisted')
     limit 1`,
    [id],
  );
  return rows[0] ? mapHeader(rows[0]) : null;
}

export async function listPosterOutcomeContracts(
  posterUserId: string,
): Promise<OutcomeContractHeader[]> {
  const sql = await getSql();
  const rows = await sql.query<OutcomeContractRow>(
    `select ${HEADER_COLUMNS}
     from outcome_contracts
     where poster_user_id = $1
     order by created_at desc, id desc`,
    [posterUserId],
  );
  return rows.map(mapHeader);
}
