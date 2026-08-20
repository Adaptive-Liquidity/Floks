# Coverage Audit — START → Flok BRAIN

This pack was re-audited against the original `START` AgentSea ZIP.

Skip/excluded AgentSea material was **deleted from this folder** (prompts, platform IA, routing, screen specs, upload, pipeline, macOS shell, indigo tokens, demo recording, command palette, stack recommendation). See `TAKE.md`.


## Required BRAIN specs from the Flok mapping

All of the specs explicitly marked **Take** or **Take a slice** are included byte-for-byte from the source:

### Take
- buyer_04 contract builder → Outcome Contracts
- provider_07 contract queue → Bids/select pattern
- provider_10 settlement → AEON settlement/escrow reference
- buyer_05 live execution → Contract Roost (hirer side)
- provider_08 runtime oversight → Contract Roost (operator side)
- buyer_07 evidence review → Capsules
- buyer_09 result acceptance/dispute → accept/fail/slash adaptation
- buyer_03 agent profile + provider_04 identity card → SPX402 Grade strip adaptation
- provider_06 private execution → capability-denied chrome
- buyer_10 procurement history → contract history

### Take a slice
- provider_05 mission control → parallel node/Roost mechanics only
- buyer_06 trace explorer → machine-private trace/Capsule support only
- buyer_08 governance review → rollback/denied/attestation patterns only
- provider_01 + buyer_01 dashboards → Operator/Hirer dashboard jobs only
- provider_09 analytics → Grade input ideas only
- buyer_02 marketplace → Hire Hall/open-contract mechanics only

## Supporting implementation included

- contract, run, node, evidence, decision, agent and store types
- seeded contract/run/evidence/timeline examples
- contract/run/evidence/timeline/dispute API stubs
- agent lookup API stubs for Hall/Grade patterns
- report/export API stubs for Capsule/history patterns
- execution graph, node inspector, trace tree, timeline and pipeline components
- evidence cards/drawers
- contract, score, decision, comparison and metric components
- run, buyer, provider, evidence and UI state stores
- scoring/decision/formatting helpers
- shared data/state/event/permission rules
- procurement, execution, acceptance and dispute flows
- REST/response/store/component contracts
- acceptance criteria and page-level checks

## Intentionally not included as Flok implementation authority

- Provider package upload (`provider_02`)
- AgentSea verification pipeline (`provider_03`)
- macOS presentation shell and wallpaper
- AgentSea design tokens / indigo visual system
- Provider-vs-Buyer account architecture
- demo recording controls / command palette / demo mode
- general AgentSea build prompts and stack recommendations
- `node_modules` and `.next`

These excluded systems either conflict with Flok or add noise without helping the mapped Flok features.

## Known gaps are source gaps, not packaging gaps

The START prototype itself does **not** contain production implementations for:
- real Flok Bid entities/pricing/award selection
- real AEON escrow and fund movement
- SPX402 `OC_*` Grade computation/history
- persistent production Outcome Contract storage
- Flok-specific auth/privacy enforcement
- durable contract-history persistence/search
- Flok-only node states such as `racing`, `rolled-back`, `attested`

Those must be built in Flok using `FINAL_DESIGN.md` / `BUILD.md`; this pack provides patterns and source material only.

## Reference-code coherence

AgentSea route wrappers and `platform-route.tsx` were intentionally removed from the audited pack because they are mostly shell/demo glue and depend on the excluded macOS/command-palette/demo infrastructure. The useful feature composition remains in `reference-code/features/shared/platform-panels.tsx`, with its required component dependencies included.
