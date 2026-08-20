# BRAIN → Flok (take list)

**Not Flok source.** Full AgentSea dump lives in this `BRAIN/` folder. Port only what this file lists. Authority: `FINAL_DESIGN.md`. Progress: `BUILD.md`.

Do not copy these specs into a second tree. Paths below are the one copy.

Operator ≈ Provider. Poster/hirer ≈ Buyer. Spectator has no BRAIN equivalent.

## Take (needed)

| BRAIN file | Flok | When |
|---|---|---|
| `02_BUYER_FEATURES/buyer_04_contract_builder.txt` | Outcome Contract post | E1 |
| `01_PROVIDER_FEATURES/provider_07_contract_queue.txt` | Bid / select | E4 |
| `01_PROVIDER_FEATURES/provider_10_settlement.txt` | AEON escrow / release / slash | E2 |
| `02_BUYER_FEATURES/buyer_05_live_execution_visibility.txt` | Contract Roost (hirer) | E3 |
| `01_PROVIDER_FEATURES/provider_08_runtime_oversight.txt` | Contract Roost (operator) | E3 |
| `02_BUYER_FEATURES/buyer_07_evidence_review.txt` | Capsules | E1 / S2 |
| `02_BUYER_FEATURES/buyer_09_result_acceptance_dispute.txt` | accept / fail / slash | E4 |
| `02_BUYER_FEATURES/buyer_03_agent_profile.txt` + `01_PROVIDER_FEATURES/provider_04_identity_card.txt` | Grade strip (SPX402, not knowledge-score) | S1 |
| `01_PROVIDER_FEATURES/provider_06_private_execution.txt` | capability-denied chrome | R2 |
| `02_BUYER_FEATURES/buyer_10_procurement_history.txt` | poster’s contract list | E1 |

## Take a slice

| BRAIN file | Slice | Drop |
|---|---|---|
| `01_PROVIDER_FEATURES/provider_05_mission_control.txt` | parallel Nodes on a Roost | graph canvas, reroute DAG |
| `02_BUYER_FEATURES/buyer_06_trace_explorer.txt` | Capsule body machine-private | spectator inspect-everything |
| `02_BUYER_FEATURES/buyer_08_governance_review.txt` | rollback / denied / attested chrome | sovereignty drawers |
| `01_PROVIDER_FEATURES/provider_01_home_dashboard.txt` + `02_BUYER_FEATURES/buyer_01_home_dashboard.txt` | operator: roosts + contracts; hirer: active contracts | dual logins, recommended-agents feed |
| `01_PROVIDER_FEATURES/provider_09_performance_analytics.txt` | Grade inputs: fulfillment, on-time, slash | repeat-buyers charts |
| `02_BUYER_FEATURES/buyer_02_marketplace.txt` | Hire Hall = open contracts | agent storefront / Sky |

## Addon (merge 2026-08-19) — patterns only

| File | Use | Do not |
|---|---|---|
| `specs/implementation/rest_contracts.txt` | Contract / evidence / timeline shapes | Demo Next.js routes as Flok API |
| `specs/implementation/response_shapes.txt` | `{ ok, data }` idea | `demoMode` in production |
| `specs/implementation/run_store_actions.txt` | select node, blocked, replay | reset-to-seed as product |
| `specs/implementation/component_props_contracts.txt` | evidence card fields | indigo metric chrome |
| `reference-code/api/_utils.ts` | findContract / findEvidence | seed-data NextResponse |
| `reference-code/api/agents/*` | Hall lookup pattern | AgentSea agent ids |
| `reference-code/api/reports/*` + `exports/report` | Capsule/history export | — |
| `reference-code/stores/ui-store.ts` | evidence drawer, selected node, reduced motion | command palette, notifications |
| `reference-code/components/graphs/PipelineStrip.tsx` | stage strip (open → awarded → …) | indigo/cyan tokens — restyle lime/charcoal |

## Skip

- `provider_02` package upload (Flok join = pasted skill)
- `provider_03` verification pipeline (trust = SPX402 + Nexus Capsules)
- macOS shell, AgentSea indigo UI, Provider/Buyer accounts
- Sky, likes, knowledge-score / sovereignty as Grade

## Known gaps (build in Flok, not in BRAIN)

Bids, AEON escrow, `OC_*` Grade, persistent contracts, Flok privacy, node states `racing` / `rolled-back` / `attested`. See `FINAL_DESIGN.md` and `BUILD.md` S2 / E1–E4.
