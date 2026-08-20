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

---

## Git / GitHub workflow

This section is the **authority** for how work is published. When `.grok/` exists, a `git-publish` skill may hold the procedure; it must not contradict this file.

### Default path

```
approved task
→ feature branch (never main)
→ implement
→ verify
→ inspect diff
→ focused commit
→ push
→ PR (draft until verified)
→ CI
→ review
→ explicit merge approval
→ update BUILD.md if status changed
```

Do not commit directly to `main`, silently push unfinished work, create duplicate PRs, mix unrelated changes, or bypass verification.

### Branches

- Never develop directly on `main`.
- Before starting approved work, confirm: current branch, working-tree status, remote/base branch, unrelated existing changes.
- Create a focused branch from current `main` for each approved phase/task.
- Names: `chore/repo-cleanup-phase-2`, `ci/build-verification`, `feat/cluster-index`, `fix/claim-rate-limit`, `docs/git-github-workflow`.
- Never overwrite, discard, stage, or commit unrelated user work.
- Stage **only files for the approved task**. Do not `git add .` or `git add -A`.
- Review the staged diff before every commit.

Never commit: `.env` or secrets; credentials/tokens; `node_modules`; build/cache output; screenshots/test output unless required; Grok temporary/runtime state. Generated files only when the repo intentionally tracks them.

### Before committing

Run verification appropriate to the change.

Once CI exists, the normal minimum gate is:

```bash
npm run verify
```

For application behavior, also run the relevant integration/browser smoke checks.

Do not commit a known failing change unless the failure is pre-existing and clearly reported.

### Commits

Focused, conventional-style subjects:

```
feat: add cluster index
fix: protect seed endpoint
chore: prune obsolete BRAIN references
ci: add build verification workflow
docs: establish repository source of truth
refactor: remove unused multiplayer scaffold
test: add pulse filtering coverage
```

One coherent change per commit. Do not mix unrelated cleanup with feature work.

### Authorization (separate actions)

1. stage
2. commit
3. push
4. create/update PR
5. merge

Do not assume permission for a later action because an earlier one was approved. If the user explicitly authorizes a complete publish workflow, perform only that scope. **Never merge a PR unless explicitly authorized.**

### Before pushing

- Confirm the branch is not `main`.
- Confirm the commit contains only intended files.
- Confirm verification results.
- Check whether remote `main` moved; update/rebase safely if needed.
- Never force-push unless explicitly authorized and genuinely necessary.

### Pull requests

One approved task/phase → one PR. Check for an existing matching PR first. Target `main` unless the repo uses another integration branch.

Create PRs as **drafts by default** until verification is complete, unless told otherwise.

PR body:

```
## What changed
concise description

## Why
reason / approved BUILD item

## Verification
commands/checks run and results

## Risk
low / medium / high + important concerns

## Not changed
important out-of-scope areas
```

For BUILD work, reference the task/phase ID.

### CI and merging

Once GitHub Actions exists, do not recommend merging while required checks fail.

Required checks should cover: formatting, lint, TypeScript, tests, pure production build, integration smoke.

If a check fails: (1) did this change cause it? (2) fix if yes; (3) rerun; (4) report pre-existing failures separately. Do not bypass or weaken CI to make a PR green.

### After merging

Only when explicitly authorized: confirm merge, update local `main`, delete the feature branch if appropriate, ensure a clean workspace, update `BUILD.md` if status changed.
