# Flok extension — not in upstream SPX402 yet

Add these in SPX402 (and consume from Flok). Until they exist, Hall stays
closed and Grade renders **SPX404**.

## 1. Turn on the stub category

In `src/lib/agents/categories.ts`, `task_executor` already exists:

```
decoderLive: false
identifierKind: "executor_wallet"
blurb: "Agents that complete priced tasks attested via the Validation Registry."
```

When the OC decoder ships, set `decoderLive: true`. Optionally add a clearer
id `outcome_contract` — only if SPX402 agrees; until then reuse `task_executor`.

## 2. Event types to add (`src/lib/agents.ts` `EventType`)

Do **not** reuse `TASK_COMPLETED` as fulfillment. It is too generic.

```
OC_OPENED      success/info    contract posted, escrow locked
OC_AWARDED     info            Cluster selected, bound armed
OC_FULFILLED   success         checkable outcome met + Capsule attested
OC_FAILED      critical        outcome missed / expired / rejected
OC_SLASHED     critical        escrow slashed
```

Optional later (only if needed, don’t invent more now):

```
OC_BID         info
OC_ACCEPTED    info            poster accepted delivery
```

## 3. New scoring branch

In `scoring.server.ts`, today `task_executor` falls through to tokenized
buyback math and produces a neutral SPX404. Replace that with
`scoreOutcomeContract(inputs)`:

| Slot (reuse breakdown keys for now) | OC meaning | Weight |
|---|---|---|
| `buybackExecution` | fulfillment rate | 25 |
| `burnConfirmation` | on-time rate | 20 |
| `depositConsistency` | awarded-contract density | 20 |
| `failedTx` | inverse slash + fail count | 15 |
| `recency` | last OC event | 10 |
| `operator` | operator verified | 5 |
| `metadata` | public Capsule present | 5 |

Rollback-then-recover can live inside `failedTx` (recoveries restore points;
unrecovered rollbacks spend them).

## 4. Failure-decoder coverage

`src/routes/api.public.cron-scoring.ts`:

```
task_executor: 0   // today
```

Set to `1.0` only when `OC_FAILED` and `OC_SLASHED` are actually emitted.
Until then, confidence stays capped — that is intentional.

## 5. Subject id

SPX402 subjects are mint / core_asset / executor_wallet.

Flok should register each Cluster (or operator wallet) as a `task_executor`
subject so Grade is per-crew, not per-Node.

## 6. Capsule ↔ evidence

Flok Capsule hash = `spx.evidence.v1` `raw_tx_hash` (or the Merkle leaf).

```
Nexus ExecutionReceipt  →  Capsule (public-safe)
                        →  SPX402 evidence row (OC_*)
                        →  cron-scoring  →  Grade + confidence
```

## 7. Hall gate

```
if grade == "SPX404" or decoderLive == false:
    Hire Hall closed (or bid disabled)
```

This already matches how SPX402 treats `task_executor` today.
