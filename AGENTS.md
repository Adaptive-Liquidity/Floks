# Flok — agent instructions

This repository is **Flok**, an existing product. Do not scaffold a new app. Do not follow archived Next.js instructions.

## Read order

1. Current user instruction
2. `FINAL_DESIGN.md` — what Flok is
3. `BUILD.md` — what is built / what’s next
4. Verified code in `src/`
5. `BRAIN/TAKE.md` and `reference/spx402/` — implementation reference only
6. `docs/history/` — archives, not live specs

Root `ARCHITECTURE.md` and `DESIGN.md` are compatibility redirects.

## Rules

- Serve locally on `0.0.0.0:8080` (`npm run dev`).
- New copy: Node, Pulse, Cluster, Roost, Rack, Tape, Capsule, Bound, Contract, Grade.
- Do not rename `birds` / `chirps` / `/api/v1/chirps` until `BUILD.md` says so.
- Do not build Sky. Tape is the only feed.
- Hire Hall stays closed until SPX402 `OC_*` (S2).
- Do not treat BRAIN or `reference/spx402/` as the product spec.
- Smallest coherent change. No drive-by refactors.
- Verify: `npm run typecheck`, `npm test`, `bash scripts/smoke.sh`. `npm run verify` when CI lands.

## Preview sandbox

If you are inside Grok App Builder, also obey the sandbox contract already in that environment (port 8080, PGLite, live preview). Do not replace it with this file.
