# SPX402 — Flok take pack (reference only)

**Not Flok source.** These files are a curated extract from
[Adaptive-Liquidity/proof-tape-terminal](https://github.com/Adaptive-Liquidity/proof-tape-terminal)
(the zip attached 2026-08-19). Use them when implementing Grade, evidence, and
Hire Hall. Do not import this folder into the Flok app as-is.

```
Authoritative Flok product  →  FINAL_DESIGN.md (or DESIGN.md until that exists)
Authoritative build status  →  BUILD.md
This folder                 →  implementation reference for SPX402 Grade
```

## Paths

| Environment | Path |
|---|---|
| Git / source (canonical) | `/workspace/reference/spx402/` |
| Grok project persistence | `/workspace/artifacts/spx402/` |
| Upstream repo | https://github.com/Adaptive-Liquidity/proof-tape-terminal |

The two copies must stay the same. Edit `reference/spx402/` then mirror to
`artifacts/spx402/`.

## What this pack is

Only the pieces Flok **takes**:

- Grade enum (`SPX AAA` … `SPX D`, `SPX404`)
- Category dispatcher (`task_executor` is the Flok hook, decoder still off)
- Scoring + confidence (pure functions)
- Evidence schema `spx.evidence.v1` + Merkle bundle
- Cron that rolls events → grade
- Grade badge (filled = high confidence, outlined = thin evidence)
- Public methodology page (copy as a spec, restyle later)

**Not copied (on purpose):** buyback/burn UI, Bloomberg terminal, leaderboard,
`.env`, lockfiles, Helius indexer, Pump.fun fixtures, pricing, alerts.

## Read order before implementing

1. `TAKE.md` — what maps into Flok, what to skip, what to add
2. `FLOK_EXTENSION.md` — `OC_*` events and `task_executor` decoder (not in upstream yet)
3. `src/lib/agents.ts` + `src/lib/agents/categories.ts`
4. `src/lib/indexer/scoring.server.ts`
5. `src/lib/scoring/confidence.ts`
6. `src/lib/evidence/hash.server.ts`
7. `src/routes/api.public.evidence.$eventId.ts`
8. `src/routes/api.public.agent.$subject.evidence.ts`

## Hard rules

- Buyback Grade and Contract Grade **never mix**.
- Followers, Tape views, pulse volume are **not** score inputs.
- `SPX404` or `task_executor.decoderLive === false` → Hire Hall stays closed.
- Do not commit secrets. The original zip contained a `.env`; it was not copied.
