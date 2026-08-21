import assert from "node:assert/strict";
import test from "node:test";
import { getSql } from "./db.ts";
import { outcomeContractInputSchema } from "./outcome-contract.ts";
import {
  ContractLimitError,
  createOutcomeContract,
  getPublicOutcomeContract,
  listPosterOutcomeContracts,
} from "./outcome-contracts.server.ts";

process.env.FLOK_POSTER_SECRET ??= "outcome-contract-test-poster-secret";

const valid = {
  outcomeClass: "artifact" as const,
  outcome: "Publish a machine-checkable signed release artifact.",
  proofRequirements: [
    { verifier: "hash" as const, requirement: "SHA-256 artifact digest" },
    { verifier: "capsule" as const, requirement: "Public Capsule digest" },
  ],
  deadline: "2099-08-20T18:00:00.000Z",
  bound: { amount: "1200.50", currency: "usdc" },
  visibility: "public" as const,
};

test("Outcome Contract input accepts a bounded public header", () => {
  const parsed = outcomeContractInputSchema.parse(valid);
  assert.equal(parsed.bound.currency, "USDC");
  assert.deepEqual(parsed.proofRequirements, valid.proofRequirements);
});

test("Outcome Contract input rejects private or extra fields", () => {
  assert.equal(
    outcomeContractInputSchema.safeParse({ ...valid, poster: "@spoofed" }).success,
    false,
  );
  assert.equal(
    outcomeContractInputSchema.safeParse({ ...valid, visibility: "private" }).success,
    false,
  );
});

test("Outcome Contract persistence scopes history and exposes only public headers", async () => {
  const suffix = crypto.randomUUID();
  const ownerA = `owner-a-${suffix}`;
  const ownerB = `owner-b-${suffix}`;
  const contractA = await createOutcomeContract(ownerA, valid);
  const contractB = await createOutcomeContract(ownerB, {
    ...valid,
    outcome: "Publish a second independently verifiable release artifact.",
  });

  const own = await listPosterOutcomeContracts(ownerA);
  assert.deepEqual(
    own.map((contract) => contract.id),
    [contractA.id],
  );
  assert.match(contractA.poster, /^@poster_[a-f0-9]{32}$/);
  assert.notEqual(contractA.poster, contractB.poster);

  const publicHeader = await getPublicOutcomeContract(contractA.id);
  assert.deepEqual(publicHeader, contractA);
  assert.equal(Object.hasOwn(publicHeader ?? {}, "poster_user_id"), false);

  const sql = await getSql();
  const stored = await sql.query<{ poster_user_id: string }>(
    "select poster_user_id from outcome_contracts where id = $1",
    [contractA.id],
  );
  assert.equal(stored[0]?.poster_user_id, ownerA);
});

test("Outcome Contract input requires a future deadline and explicit proof", () => {
  assert.equal(
    outcomeContractInputSchema.safeParse({ ...valid, deadline: "2020-01-01T00:00:00.000Z" })
      .success,
    false,
  );
  assert.equal(
    outcomeContractInputSchema.safeParse({ ...valid, proofRequirements: [] }).success,
    false,
  );
  assert.equal(
    outcomeContractInputSchema.safeParse({
      ...valid,
      outcome: "Publish a signed artifact\u061c with a hidden direction marker.",
    }).success,
    false,
  );
  assert.equal(
    outcomeContractInputSchema.safeParse({
      ...valid,
      outcome: "Publish a signed artifact with an invalid surrogate \ud800.",
    }).success,
    false,
  );
  assert.equal(
    outcomeContractInputSchema.safeParse({
      ...valid,
      proofRequirements: [{ verifier: "hash", requirement: "Invalid \udfff digest" }],
    }).success,
    false,
  );
});

test("Outcome Contract creation enforces the poster quota atomically", async () => {
  const owner = `quota-${crypto.randomUUID()}`;
  const sql = await getSql();
  await sql.query(
    `insert into outcome_contract_poster_quotas (poster_user_id, poster, contract_count)
     values ($1, $2, 100)`,
    [owner, `@poster_${"a".repeat(32)}`],
  );
  await assert.rejects(() => createOutcomeContract(owner, valid), ContractLimitError);
  const rows = await sql.query<{ count: number }>(
    "select count(*)::int as count from outcome_contracts where poster_user_id = $1",
    [owner],
  );
  assert.equal(rows[0]?.count, 0);
});
