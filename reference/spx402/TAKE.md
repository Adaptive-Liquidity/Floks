# What Flok takes from these files

Rename / port into Flok. Do not vendor the SPX402 app.

| This file | Keep | Flok name | Skip |
|---|---|---|---|
| `src/lib/agents.ts` | `Grade`, `Severity`, evidence-shaped `AgentEvent` | Grade on Index / bid / OG | `DEPOSIT_*` / `BUYBACK_*` / `BURN_*` as Flok inputs |
| `src/lib/agents/categories.ts` | `task_executor` row | Outcome Contract category | `tokenized_buyback` as the Flok scorer |
| `src/lib/indexer/scoring.server.ts` | `Grade`, `SPX404`, `gradeFromTotal`, `recencyScore`, `operatorVerified`, category `switch` | New `scoreOutcomeContract()` branch | `scoreTokenized()`, `scoreX402()` for Flok subjects |
| `src/lib/scoring/confidence.ts` | confidence ≠ grade; `band`; failure-decoder coverage | Outlined vs filled badge | Expected-event map for buybacks |
| `src/lib/scoring/risk-score.ts` | version stamp `spx-score-v0.3.0` | Keep version on every Grade snapshot | Nothing else |
| `src/lib/evidence/hash.server.ts` | canonical JSON, sha256, Merkle root | Capsule digest | — |
| `src/routes/api.public.evidence.$eventId.ts` | `spx.evidence.v1` body | One Capsule ↔ one evidence row | Solana `tx_signature` required (Flok may use Capsule id) |
| `src/routes/api.public.agent.$subject.evidence.ts` | 30-day bundle + `evidence_root` | Grade snapshot bound to a window | Mint-as-subject only (Flok subject = handle or operator wallet) |
| `src/routes/api.public.cron-scoring.ts` | `FAILURE_DECODER_COVERAGE.task_executor: 0` | Stay 0 until `OC_*` decoder ships | Tokenized coverage numbers |
| `src/components/spx/ExecutionGradeBadge.tsx` | filled vs outlined; `SPX404` | Restyle cream/charcoal/lime | Bloomberg colors |
| `src/routes/methodology.tsx` | public commitment, event taxonomy, ladder | Link out / restyle | Buyback weight table as Flok math |
| `src/lib/indexer/__tests__/scoring.golden.test.ts` | golden tests | Add OC fixtures when decoder exists | Don’t change existing buyback goldens |

## Score inputs Flok is allowed to use

- fulfillment rate (`OC_FULFILLED` / awarded)
- on-time rate
- rollback-then-recover rate
- slash count (`OC_SLASHED`)
- recency
- operator verified

## Score inputs Flok is forbidden to use

- buybacks, burns, deposits
- x402 payment volume
- followers, Tape views, pulse / chirp volume
