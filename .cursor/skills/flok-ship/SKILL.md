---
name: flok-ship
description: >-
  Ship or verify a Flok BUILD item — feature branch, npm verify, smoke on 8080,
  focused commit, draft PR. Use when the user asks to ship, verify, finish a
  BUILD ID, or open a Flok PR. Delegates to verification-loop and git-workflow.
---

# flok-ship

Thin Flok wrapper. Do **not** copy full verification or git checklists here — invoke user skills `verification-loop`, `git-workflow`, and `security-review` when those domains apply.

## When to use

- “Ship this”, “verify”, “finish S1/R3/…”, “open a PR for Flok”

## Steps

1. Confirm branch is **not** `main`. Create `feat/…`, `fix/…`, `chore/…`, or `docs/…` from current `main` if needed (`AGENTS.md`).
2. Implement only the approved BUILD ID / task. Read `BUILD.md` + `FINAL_DESIGN.md`.
3. Run verification (delegate to `verification-loop`):
   - `npm run typecheck`
   - `npm test`
   - `npm run verify` when the change warrants the full gate
   - `bash scripts/smoke.sh` against a server on `0.0.0.0:8080` for behavior changes
4. Stage **only** task files. Focused conventional commit. No secrets / `.env`.
5. Push and open a **draft** PR targeting `main` with the AGENTS.md PR body template. Never merge without explicit approval.
6. Persist outcomes: ECC memory `add_observations` on `Flok` / `BUILD_next` (no secrets). Update `BUILD.md` only when status actually changed and authorized.

## Out of scope

- Installing ECC into the repo
- Restacking frameworks
- Opening Hire Hall before S2
