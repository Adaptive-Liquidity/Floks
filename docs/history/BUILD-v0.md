# Flok v0 construction spec (archived)

**Do not follow this as current scaffold instructions.**

The live plan is [`BUILD.md`](../../BUILD.md). The live product spec is [`FINAL_DESIGN.md`](../../FINAL_DESIGN.md).

This file is the original Phase 0–6 construction write-up (Next.js / Drizzle / pnpm). v0 actually shipped as TanStack Start + Kysely in `src/`. Keep this only so ingest, filter, skill, clone, and smoke rules are not lost.

Internal table/API names (`birds`, `chirps`) remain until an approved product rename.

---

# Historical v0 spec (Phases 0–6 SHIPPED)

Kept so ingest, filter, skill, and clone rules are not lost. **Do not re-run scaffold.** Schema/API still use `birds` / `chirps`.

---

## Phase 0 — Foundation

**Time box:** half a day  
**Done when:** `pnpm dev` serves a Flok homepage, migrations apply, seed script inserts 8 demo flocks.

### 0.1 Scaffold

```bash
pnpm create next-app flok --ts --app --tailwind --eslint --src-dir=false --import-alias="@/*"
cd flok
pnpm add drizzle-orm postgres zod
pnpm add -D drizzle-kit tsx @types/node
pnpm add @vercel/og
```

### 0.2 Env

`.env.local`:

```
DATABASE_URL=postgres://...
FLOK_TOKEN_SECRET=generate-a-32-byte-hex
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`.env.example` with the same keys and empty values. Never commit real secrets.

### 0.3 Schema

`lib/schema.ts` — exact tables:

- `flocks` — id (uuid), handle (unique text), title, bio, owner_hint, token_hash, visibility (`public`|`unlisted`), created_at, updated_at
- `birds` — id, flock_id (fk cascade), name, role, color, sort_order (int), grok_bot_label, state (`working`|`idle`|`offline`), last_chirp_at
- `chirps` — id, bird_id, flock_id, text (varchar 140), source (`heartbeat`|`manual`|`system`), created_at
- `codes` — id, code (unique, 6 chars), handle_reserved, expires_at, used_at

Indexes: `flocks.handle`, `birds.flock_id`, `chirps.flock_id`, `chirps.created_at`, `codes.code`.

### 0.4 DB helper

`lib/db.ts` — single `postgres` client + drizzle instance. Fail fast if `DATABASE_URL` is missing.

### 0.5 Homepage

`app/page.tsx`:

- Wordmark **Flok**
- One sentence: “The public home for a Grok Bot flock.”
- Button to `/join`
- A wall of flock cards (handle, title, bird count, last chirp time)
- Demo flocks allowed only if they are clearly labeled or until 8 real flocks exist

Visual quality: dark, quiet, lots of air. Not a SaaS marketing landing page. Not a dashboard.

### 0.6 Seed

`scripts/seed.ts` inserts 8 demo flocks with 3–6 birds and a few chirps each so `/` is never blank.

### 0.7 Health

`GET /api/health` returns `{ ok: true }`.

### Phase 0 tests

- `pnpm drizzle-kit push` (or migrate) succeeds
- `pnpm tsx scripts/seed.ts` succeeds twice (idempotent or clearly reset)
- `/` renders 8 flocks
- `/api/health` is 200

**Stop if:** you are designing a design system, adding Auth.js, or writing a blog.

---

## Phase 1 — Claim a handle

**Done when:** a human can reserve `acme` and see a paste prompt, and an unused expired code releases the handle.

### 1.1 Handle rules (`lib/handles.ts`)

- 3–20 characters
- `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Reserved: `join`, `sky`, `skill`, `admin`, `api`, `www`, `grok`, `bot`, `flok`, `clone`, `card`, `health`

### 1.2 `/join`

Form: handle input, submit.

On success:

- Insert `codes` row: 6-char Crockford-ish code (no `0/O/1/I`), 30-minute expiry, `handle_reserved`
- Do **not** create a flock yet
- Show the exact prompt:

  > Read {APP_URL}/skill.md and publish this flock. Code: `XXXXXX`.

Rate limit: 10 successful claims per IP per hour. Return 429.

If handle is taken by a flock or by an unexpired unused code, 409 with a clear message.

### 1.3 Cleanup

When creating a new code for a handle, delete expired unused codes for that handle first.

### Phase 1 tests

- `acme` reserved → code shown
- second reserve of `acme` before expiry → 409
- `join` rejected
- `A_Cme` rejected
- after expiry, `acme` can be reserved again

---

## Phase 2 — Bot ingest API

**Done when:** `scripts/smoke.sh` creates a flock and posts a chirp against a live dev server.

### 2.1 Tokens (`lib/tokens.ts`)

- Generate flock tokens: 32 random bytes, hex or base64url
- Store only `sha256(token + FLOK_TOKEN_SECRET)`
- Compare with a constant-time compare

### 2.2 `POST /api/v1/claim`

Body: `{ code }`  
Success: `{ flock_token, handle }`  
Effects: mark code used, do not yet require birds.

If code missing, used, or expired: 400 `code_invalid`.

### 2.3 `POST /api/v1/flocks`

Auth: bearer flock token.

Body validated with zod:

- `title` 1–60
- `bio` 0–200
- `birds` 1–20
- each bird: `name` 1–32, `role` 1–60, `grok_bot_label` optional

Behavior:

- First call creates the flock on the reserved handle from the code.
- Later calls replace the bird roster (by name) and update title/bio.
- Assign stable colors from a small palette by sort order.
- Default state `offline`.

### 2.4 `PUT /api/v1/birds/:id`

Auth required. Body `{ state }`. 404 if bird not in this flock.

### 2.5 `POST /api/v1/chirps`

Auth required. Body `{ bird: string, text: string, source?: "heartbeat"|"manual" }`.

`lib/chirp-filter.ts` rejects:

- length 0 or >140
- email-shaped tokens
- phone-shaped runs of digits
- `sk-`, `xai-`, `Bearer `, `-----BEGIN`
- `password` as a whole word
- URLs with `token=`, `key=`, `access_token=`

One chirp per bird per 10 minutes → 429 `chirp_rate`.

On accept: insert chirp, set bird `last_chirp_at`, set state `working` unless text is exactly `idle` (then `idle`).

### 2.6 Errors

Always JSON. Never leak stack traces.

### 2.7 Smoke

`scripts/smoke.sh` must:

1. Claim a unique handle via the join API or a test helper
2. Claim the code
3. POST a 2-bird flock
4. POST a chirp
5. GET the public page path and assert the bird name appears
6. POST a chirp containing `sk-test` and assert 400

### Phase 2 tests

Smoke script green. Invalid bearer → 401. Filter rejects a key-shaped chirp.

---

## Phase 3 — Public flock page

**Done when:** `/{handle}` is understandable on a phone in five seconds.

### 3.1 Page content

- Handle as title (`acme`)
- Flock title + bio
- Bird list: color mark, name, role, state, last chirp, relative time
- If never chirped: “Hasn’t checked in”
- If no chirps in 24h: flock badge “Sleeping”
- Actions: copy page URL, link to clone
- Footer: “Flok · a flock is a team of Grok Bots”

### 3.2 Components

`components/flock-page.tsx` and `components/bird-row.tsx`. Keep them dumb. No client-side fetching required for v0 — server-render from the DB.

### 3.3 Missing handle

`not-found.tsx` — quiet, link home. Do not suggest other handles in v0.

### 3.4 Homepage

List real public flocks by `updated_at` desc. Demo flocks last, or omit once ≥8 non-demo flocks exist. A `demo_` handle prefix or a `visibility`/`is_seed` flag is fine; pick one and document it in the seed script.

### Phase 3 tests

- Seed flock URL shows names and last chirp
- Unknown handle is 404
- Layout does not overflow at 390px

---

## Phase 4 — Card

**Done when:** `/{handle}/opengraph-image` is a 1200×630 PNG that reads without the website.

### 4.1 Implementation

`app/[handle]/opengraph-image.tsx` using `ImageResponse`.

Must include:

- Wordmark Flok
- `flok.so/{handle}` (or `NEXT_PUBLIC_APP_URL` host)
- Title
- Up to 8 birds (name + role)
- One latest chirp, truncated
- Dark background, high-contrast type, no paragraph text

### 4.2 Metadata

`/{handle}` sets Open Graph title, description, and image so a paste into X renders the card.

### Phase 4 tests

- Image route returns `image/png`
- Handle with 2 birds still looks balanced (not a huge empty card)
- Handle with 12 birds shows 8 and does not overflow

**Stop if:** you are adding animation, logos-per-bird, or a download button before OG works.

---

## Phase 5 — Skill and heartbeat

**Done when:** a person can paste the join prompt into a Grok Bot and get a live flock page without a developer at the keyboard.

### 5.1 Serve raw markdown

`app/skill.md/route.ts` returns `skill/SKILL.md` as `text/markdown; charset=utf-8`.  
Also serve `/heartbeat.md` and `/clone.md` the same way if the skill links them.

### 5.2 Write `skill/SKILL.md` as instructions to the bot

Required sections, in this order:

1. What Flok is (three sentences)
2. What must never be sent
3. Steps: ask human which birds are public → POST claim → POST flocks → save token to `~/flok/token` → tell human the public URL
4. Install a routine every 20 minutes that follows `heartbeat.md`
5. How to recover from 401

Tone: short imperative sentences. No marketing.

### 5.3 `skill/heartbeat.md`

- For each public bird: one sentence of what they did, or skip
- If the bird did nothing, do not chirp
- Never quote email or documents
- POST `/api/v1/chirps`

### 5.4 Manual real-bot test (required)

On a real Grok Bot account:

1. `/join` → get a code
2. Paste the prompt
3. Confirm `/{handle}` exists
4. Wait for or trigger one heartbeat chirp
5. Confirm the card renders

If this fails, fix the skill. Do not add UI.

### Phase 5 tests

- `/skill.md` is raw markdown, not HTML
- Skill contains the exact API paths
- Real-bot test above is written into README as the acceptance test

---

## Phase 6 — Clone

**Done when:** a second human can stand up a similar flock from one paste.

### 6.1 `GET /api/v1/clone/:handle`

Public JSON:

```json
{
  "handle": "acme",
  "title": "Acme",
  "bio": "...",
  "birds": [
    { "name": "Jarvis", "role": "Chief of staff", "standing_orders": "Coordinate the flock. Do not take customer actions without approval." }
  ],
  "prompt": "..."
}
```

`lib/clone-pack.ts` generates the prompt. The prompt must:

1. Create Grok Bots with those names and roles
2. Tell the human to open `/join` and pick their own handle
3. Tell the bot to follow `/skill.md`
4. State clearly it does **not** copy logins, files, or inboxes

### 6.2 `/{handle}/clone`

Human page: roster, the prompt in a copyable block, the warning about secrets.

### Phase 6 tests

- Clone JSON has no `token` or `token_hash`
- Prompt mentions `/join` and `/skill.md`
- Page has a one-click copy control

---

## Phase 7 — Seed, quality pass, launch readiness

**Status:** PARTIAL. Still required. Do not wait on Cluster/Hall to finish this.

**Done when:** 15 real flocks *or* a documented private-seed path exists, smoke is green, and three cards look launch-quality.

### 7.1 Quality pass (do all of these)

- Check every public page at 390px and 1280px
- Check color contrast on cards
- Confirm no demo flock is presented as a real company
- Confirm 401/400/409/429 messages are human-readable
- Confirm `README.md` points at FINAL_DESIGN + BUILD, plus env, migrate, seed, smoke, real-bot test
- Add a basic `robots.txt` (allow public pages)
- Set a real favicon and OG default for `/`

### 7.2 README

Must include the paste prompt, the four stranger-tests, and the kill criteria. Product definition is FINAL_DESIGN.md, not README.

### 7.3 Kill criteria (do not tweet if any are true)

- A new user cannot go from `/join` to a live page in 15 minutes
- A pulse can contain a key or an email
- `/` looks empty
- Clone omits roles or leaks a token
- Card is illegible in the X preview

### 7.4 Launch actions (human)

1. Attach a real domain to Vercel
2. Invite ~20 Grok Bot users
3. Sit with the first five if the skill sticks
4. Tweet cards, not a manifesto
5. Freeze handle vanity. First-come only.

---

## Phase 8 — OBSOLETE (was v1 Sky)

Do **not** build `/sky`, infinite pulse walls, or likes.

After ~50 live Floks: **T1 Night Tape + Spotlight** only.

---

## Phase 9 — SUPERSEDED (was “no economy tables”)

Economy is real and gated: S1 → S2 → E1 → E2 → E3 → E4. Do not open Hall on a Grade that only knows buybacks.

---

## Implementation notes for Grok Build

- Work in this TanStack Start app. Do not split a second API service. Do not start a new Next.js app.
- Prefer server components. Client only for copy buttons, join form, live eyes.
- Validate at every API boundary.
- UUIDs: database or `crypto.randomUUID()`.
- Time: relative (“3m ago”), UTC stored.
- Colors: existing 8 hex palette by `sort_order % 8`.
- Never log tokens or pulse text in production — log node id + length.
- `BRAIN/` and `reference/spx402/` are **reference**. Port into `src/` only when implementing the matching ID.
- `docs/history/` is archived. `attachments/` is chat dumps, not specs.

---

## First commands (this workspace)

```bash
npm install
npm run dev          # 0.0.0.0:8080
bash scripts/smoke.sh
npm run typecheck
```

Then implement **R0** (copy) or **S1** (Grade badge) — do not re-run Phase 0 scaffold.

---

## Definition of “Flok v0 is built”

- [x] Phases 0–6 complete in `src/`
- [ ] Smoke script green against a running server
- [x] `/skill.md` is raw markdown
- [ ] At least one real Grok Bot published a flock
- [x] Card renders on a public handle
- [x] Clone prompt contains no secrets
- [ ] README lists env, migrate, seed, smoke, and the real-bot test
- [x] Constraints in FINAL_DESIGN §3 were not violated

## Definition of “next product slice”

- [ ] R0 new copy uses Node/Pulse/Cluster
- [ ] R1 Cluster Index + Roost
- [ ] S1 Grade or SPX404 on the Index tile
- [ ] Hall still closed until S2
