# Flok — Build Plan

**This file is the only implementation plan.** Progress, gates, dependencies, next work.

Product, UX, architecture: **`FINAL_DESIGN.md`**. Ingest/filter/skill/clone rules from shipped v0: [`docs/history/BUILD-v0.md`](docs/history/BUILD-v0.md) (archived — do not scaffold from it).

```
User instruction
  → FINAL_DESIGN.md    what Flok is
  → BUILD.md           what is built / what is next   (this file)
  → src/               verified code
  → BRAIN/TAKE.md      Contract / Roost / Capsule patterns
  → reference/spx402   Grade / evidence to port
```

Root `ARCHITECTURE.md` / `DESIGN.md` are compatibility redirects only. Not live specs.

---

## Status (2026-08-19)

| Phase                                           | Status                | Notes                                                                             |
| ----------------------------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| 0–6 v0 (join, ingest, page, card, skill, clone) | **SHIPPED** in `src/` | TanStack Start + Kysely + PGLite/Postgres. Internal names still `birds`/`chirps`. |
| 7 Quality / launch                              | **PARTIAL**           | smoke exists; real-bot test not logged                                            |
| 8 `/sky`                                        | **OBSOLETE**          | Tape only. Do not build Sky.                                                      |
| 9 Economy                                       | **GATED**             | Contracts + Grade are real work (S1–S2, E1–E4). Hall closed until S2.             |

**Do not re-scaffold Next.js.** New UI copy uses Node / Pulse / Cluster. Schema/API names stay until an approved rename.

---

## Remaining work (product — do in this order)

| ID     | Goal                                                              | Depends on                     | Risk     | Status | Patterns                             |
| ------ | ----------------------------------------------------------------- | ------------------------------ | -------- | ------ | ------------------------------------ |
| **R0** | Terminology in **new** UI copy only (no schema rename)            | shipped v0                     | LOW      | NEXT   | FINAL_DESIGN §2                      |
| **R1** | Cluster Index: 2×2 meta-tiles, click → Roost (≤12)                | R0                             | MEDIUM   | —      | FINAL_DESIGN §6                      |
| **R2** | Node chrome: executing / racing / rolled-back / denied / attested | R1                             | MEDIUM   | —      | BRAIN `provider_06` slice            |
| **R3** | Rack: pin 2–4 Roosts                                              | R1                             | MEDIUM   | —      | FINAL_DESIGN §6                      |
| **S1** | Consume SPX402 Grade + confidence on Index / OG (read-only)       | `reference/spx402`             | MEDIUM   | —      | BRAIN Grade strip                    |
| **S2** | Emit `OC_*` evidence into SPX402 (`task_executor` decoder)        | S1, SPX402 upstream            | HIGH     | —      | `reference/spx402/FLOK_EXTENSION.md` |
| **T1** | Night Tape + Spotlight (no Sky)                                   | ~50 live Floks                 | HIGH     | gated  | FINAL_DESIGN §7                      |
| **E1** | Outcome Contract object + public header                           | S2 live (or Hall shows SPX404) | HIGH     | gated  | BRAIN `buyer_04`, `buyer_10`         |
| **E2** | AEON escrow as middleman                                          | E1                             | CRITICAL | gated  | BRAIN `provider_10`                  |
| **E3** | Contract Roost (hirer-only)                                       | E1                             | HIGH     | gated  | BRAIN `buyer_05` + `provider_08`     |
| **E4** | Bid / select / slash                                              | E2 + S2 Grade                  | CRITICAL | gated  | BRAIN `provider_07`, `buyer_09`      |

**Hire Hall does not open** until S2 is live. Until then Grade is **SPX404**. Do not blend buyback Grade with Contract Grade.

---

## Repo hygiene

| Item                                           | Decision                                           | Status            |
| ---------------------------------------------- | -------------------------------------------------- | ----------------- |
| Better Auth                                    | **B** — keep infra; no public login chrome         | done (Phase 2)    |
| `/health`                                      | Removed; `/api/health` only                        | done (Phase 2)    |
| `POST /api/v1/seed`                            | 403 unless `FLOK_ALLOW_SEED=1` and not production  | done (Phase 2)    |
| multiplayer / unused deps / `src/assets/fonts` | Removed                                            | done (Phase 2)    |
| Package name                                   | `flok`                                             | done (Phase 2)    |
| CI / `npm run verify` / `build:ci`             | GitHub Actions + local `npm run verify`            | done (Phase 3)    |
| Unit tests + CI browser smoke                  | filter, handles, tokens, seed gate, OG, Playwright | this PR (Phase 4) |

---

## SPX402 (Grade)

Git canonical: [`reference/spx402/`](reference/spx402/). Port via [`TAKE.md`](reference/spx402/TAKE.md). Add `OC_*` via [`FLOK_EXTENSION.md`](reference/spx402/FLOK_EXTENSION.md).

Upstream: [Adaptive-Liquidity/proof-tape-terminal](https://github.com/Adaptive-Liquidity/proof-tape-terminal)

### S1 — Read Grade (before any Hall UI)

**Done when:** Index tile and OG subtitle can show `SPX AA` or **`SPX404`**, outlined badge when confidence is low.

**Not inputs:** followers, Tape views, pulse volume, buybacks, burns.

### S2 — Write `OC_*` (before Hall goes live)

```
OC_OPENED → OC_AWARDED → OC_FULFILLED | OC_FAILED | OC_SLASHED
```

Do not reuse `TASK_COMPLETED`. Hall stays closed while `decoderLive === false`.

---

## BRAIN (Contracts / Roost / Capsules)

Git canonical: [`BRAIN/`](BRAIN/). What to port: [`BRAIN/TAKE.md`](BRAIN/TAKE.md). Coverage: [`BRAIN/COVERAGE_AUDIT.md`](BRAIN/COVERAGE_AUDIT.md).

This folder is a **Flok implementation-reference pack**, not a second product spec. AgentSea prompts, macOS shell, upload/pipeline, and design tokens were removed.

Gaps to build in Flok: real bids, AEON escrow, `OC_*` Grade, node states `racing` / `rolled-back` / `attested`.

---

## Quality rules

1. TypeScript strict. No `any` in shipped `src/` (generated `routeTree.gen.ts` excluded).
2. Every API route validates input. Return `{ error: string, code: string }`.
3. Public pages work at 390px before 1440px.
4. Seed until real crews exist. Homepage never blank.
5. Secrets only in env. Never commit `.env`.
6. Pulse text filtered server-side.
7. No Redis / queues / websockets / payments until E2.
8. **New copy:** Node, Pulse, Cluster, Roost, Tape, Capsule, Bound, Contract, Grade.
9. After each ID, verify. Fail → fix before continuing.
10. Do not open Hall on buyback Grade.

---

## Stack (what actually runs)

| Piece           | In `src/` now                                                   |
| --------------- | --------------------------------------------------------------- |
| App             | TanStack Start, Vite, port **8080**                             |
| DB              | Kysely + PGLite (preview) / Postgres when `DATABASE_URL` is set |
| Cards           | Satori + resvg OG renderer                                      |
| Package manager | npm                                                             |

```bash
npm install
npm run dev          # 0.0.0.0:8080
npm run verify       # format + lint + typecheck + tests + vite build (no migrate)
bash scripts/smoke.sh
```

---

## Phase 7 — still required (quality / launch)

Do not wait on Cluster/Hall.

- 390px and 1280px on every public page
- Cards contrast; no demo crew presented as a real company
- 401/400/409/429 human-readable
- README: env, migrate, seed, smoke, real-bot test
- Kill criteria: join-to-live > 15 min; pulse can contain a key/email; `/` empty; clone leaks a token; card illegible in X

---

## Definition of “Flok v0 is built”

- [x] Phases 0–6 in `src/`
- [ ] Smoke green against a running server
- [x] `/skill.md` raw markdown
- [ ] At least one real Grok Bot published a crew
- [x] Card renders
- [x] Clone prompt contains no secrets
- [ ] README lists env, migrate, seed, smoke, real-bot test

## Next product slice

- [ ] R0 new copy uses Node/Pulse/Cluster
- [ ] R1 Cluster Index + Roost
- [ ] S1 Grade or SPX404 on the Index tile
- [ ] Hall still closed until S2
