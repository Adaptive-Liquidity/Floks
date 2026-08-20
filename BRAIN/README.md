# BRAIN — AgentSea product brain (reference only)

**Not Flok source code.** This is a complete product brain for a parallel concept (Outcome Marketplace / multi-agent execution platform). Use it as reference when redesigning Flok Outcome Contracts, Roost, Night Tape, Capsules, Grades, and settlement.

## Paths

| Environment | Path |
|---|---|
| Project artifacts (this folder) | `/home/workdir/artifacts/BRAIN/` |
| **Grok Build sandbox (use this)** | `/workspace/artifacts/BRAIN/` |
| GitHub mirror | `https://github.com/Adaptive-Liquidity/Floks/tree/main/BRAIN` |

Grok Build must **not** look for `/home/workdir/...` — that path does not exist in the Build sandbox. Always use `/workspace/artifacts/BRAIN/`.

## Start reading order

1. `00_PLATFORM_MASTER_INDEX.txt`
2. `03_SHARED_SYSTEMS/shared_04_data_models.txt`
3. `03_SHARED_SYSTEMS/shared_03_global_state_models.txt`
4. `02_BUYER_FEATURES/buyer_04_contract_builder.txt`
5. `02_BUYER_FEATURES/buyer_05_live_execution_visibility.txt`
6. `01_PROVIDER_FEATURES/provider_05_mission_control.txt`
7. `01_PROVIDER_FEATURES/provider_07_contract_queue.txt`
8. `05_RULES/rules_scoring_logic.txt` + `rules_evidence_logic.txt`
9. `03_SHARED_SYSTEMS/shared_07_motion_system.txt`

## Flok redesign constraints (must filter)

- Industrial terms only: Node, Cluster, Roost, Rack, Pulse, Tape, Capsule, Bound, Contract, Grade
- Night Tape is the only social surface
- Cluster scaling: Index → Roost (≤12) → Rack
- Outcome Contracts = AEON escrow + SPX402 bids + Nexus Capsules
- Visual: cream-on-charcoal, lime signals, animated oval eyes
- Reject: macOS shell, indigo/cyan palette, Provider/Buyer dual accounts, high-volume Sky feed

See repo `DESIGN.md` for the Flok-native pivot that already maps these concepts.
