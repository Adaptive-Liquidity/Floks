import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("0007 creates the persistent Outcome Contract header schema", async () => {
  const pg = new PGlite();
  try {
    await pg.waitReady;
    const migration = await readFile(
      new URL("../migrations/0007_outcome_contracts.sql", import.meta.url),
      "utf8",
    );
    await pg.exec(migration);

    await pg.query(
      `insert into outcome_contracts (
         id, poster_user_id, poster, outcome_class, outcome_text, proof_requirements,
         deadline, bound, visibility, version, contract_hash
       ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9, $10, $11)`,
      [
        "contract-1",
        "user-1",
        "@northstar",
        "artifact",
        "Publish a machine-checkable signed release artifact.",
        JSON.stringify(["SHA-256 artifact digest"]),
        "2099-08-20T18:00:00.000Z",
        JSON.stringify({ amount: "1200", currency: "USDC" }),
        "public",
        1,
        `sha256:${"a".repeat(64)}`,
      ],
    );

    const result = await pg.query(
      `select id, poster_user_id, proof_requirements, bound, visibility, version, contract_hash
       from outcome_contracts`,
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.poster_user_id, "user-1");
    assert.deepEqual(result.rows[0]?.proof_requirements, ["SHA-256 artifact digest"]);
    assert.deepEqual(result.rows[0]?.bound, { amount: "1200", currency: "USDC" });
    assert.equal(result.rows[0]?.visibility, "public");
    assert.equal(result.rows[0]?.version, 1);
  } finally {
    await pg.close();
  }
});

test("0007 rejects unsupported market state", async () => {
  const pg = new PGlite();
  try {
    await pg.waitReady;
    const migration = await readFile(
      new URL("../migrations/0007_outcome_contracts.sql", import.meta.url),
      "utf8",
    );
    await pg.exec(migration);
    await assert.rejects(() =>
      pg.query(
        `insert into outcome_contracts (
           id, poster_user_id, poster, outcome_class, outcome_text, proof_requirements,
           deadline, bound, status, version, contract_hash
         ) values ('contract-2', 'user-1', '@northstar', 'artifact', 'Outcome text',
           '["proof"]'::jsonb, '2099-08-20T18:00:00Z', '{"amount":"1","currency":"USDC"}'::jsonb,
           'awarded', 1, $1)`,
        [`sha256:${"b".repeat(64)}`],
      ),
    );
  } finally {
    await pg.close();
  }
});

test("0008 upgrades quotas created by the original 0007 migration", async () => {
  const pg = new PGlite();
  try {
    await pg.waitReady;
    await pg.exec(`
      create table outcome_contracts (
        id text primary key,
        poster_user_id text not null,
        poster text not null,
        created_at timestamptz not null default now()
      );
      create table outcome_contract_poster_quotas (
        poster_user_id text primary key,
        contract_count integer not null default 0
      );
      insert into outcome_contracts (id, poster_user_id, poster)
      values ('contract-1', 'user-1', '@poster_11111111111111111111111111111111');
      insert into outcome_contract_poster_quotas (poster_user_id, contract_count)
      values ('user-1', 1);
    `);

    const migration = await readFile(
      new URL("../migrations/0008_outcome_contract_posters.sql", import.meta.url),
      "utf8",
    );
    await pg.exec(migration);
    await pg.exec(migration);

    const result = await pg.query(
      "select poster from outcome_contract_poster_quotas where poster_user_id = 'user-1'",
    );
    assert.equal(result.rows[0]?.poster, "@poster_11111111111111111111111111111111");
    await assert.rejects(() =>
      pg.query(
        `insert into outcome_contract_poster_quotas (poster_user_id, poster)
         values ('user-2', '@poster_11111111111111111111111111111111')`,
      ),
    );
  } finally {
    await pg.close();
  }
});
