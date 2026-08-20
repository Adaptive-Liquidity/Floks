# SPX402 — Flok take pack (reference only)

**Not Flok source.** Curated extract from
[Adaptive-Liquidity/proof-tape-terminal](https://github.com/Adaptive-Liquidity/proof-tape-terminal).
Do not import this folder into the Flok app as-is.

```
Authority  →  ../../FINAL_DESIGN.md
Plan       →  ../../BUILD.md
This pack  →  Grade / evidence to port
```

Git canonical path: `reference/spx402/` in this repository.

## What this pack is

- Grade enum (`SPX AAA` … `SPX D`, `SPX404`)
- Category dispatcher (`task_executor` is the Flok hook, decoder still off)
- Scoring + confidence (pure functions)
- Evidence schema `spx.evidence.v1` + Merkle bundle
- Cron that rolls events → grade
- Grade badge (filled = high confidence, outlined = thin evidence)
- Public methodology page (copy as a spec, restyle later)

**Not copied:** buyback/burn UI, Bloomberg terminal, leaderboard, `.env`, lockfiles, Helius indexer, Pump.fun fixtures, pricing, alerts.

## Read order before implementing

1. `TAKE.md`
2. `FLOK_EXTENSION.md` — `OC_*` events (not in upstream yet)
3. `src/lib/agents.ts` + `src/lib/agents/categories.ts`
4. `src/lib/indexer/scoring.server.ts`
5. `src/lib/scoring/confidence.ts`
6. `src/lib/evidence/hash.server.ts`
7. evidence API routes

## Hard rules

- Buyback Grade and Contract Grade **never mix**.
- Followers, Tape views, pulse volume are **not** score inputs.
- `SPX404` or `task_executor.decoderLive === false` → Hire Hall stays closed.
- Do not commit secrets. The original zip contained a `.env`; it was not copied.
