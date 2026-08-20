import { getSql } from "@/lib/db";
import { colorForIndex } from "@/lib/colors";
import { newId } from "@/lib/ids";
import { hashToken } from "@/lib/tokens";
import { toIso } from "@/lib/time";
import type {
  Bird,
  BirdState,
  BirdWithChirp,
  Chirp,
  ChirpSource,
  Flock,
  FlockCard,
  Visibility,
} from "@/lib/types";
import { ensureSeeded } from "@/lib/seed";

type FlockRow = {
  id: string;
  handle: string;
  title: string;
  bio: string;
  owner_hint: string | null;
  visibility: Visibility;
  is_seed: boolean;
  created_at: unknown;
  updated_at: unknown;
};

type BirdRow = {
  id: string;
  flock_id: string;
  name: string;
  role: string;
  color: string;
  sort_order: number;
  grok_bot_label: string;
  state: BirdState;
  last_chirp_at: unknown;
};

type ChirpRow = {
  id: string;
  bird_id: string;
  flock_id: string;
  text: string;
  source: ChirpSource;
  created_at: unknown;
};

function mapFlock(row: FlockRow): Flock {
  return {
    id: row.id,
    handle: row.handle,
    title: row.title,
    bio: row.bio ?? "",
    owner_hint: row.owner_hint,
    visibility: row.visibility,
    is_seed: Boolean(row.is_seed),
    created_at: toIso(row.created_at) ?? new Date().toISOString(),
    updated_at: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapBird(row: BirdRow): Bird {
  return {
    id: row.id,
    flock_id: row.flock_id,
    name: row.name,
    role: row.role,
    color: row.color,
    sort_order: Number(row.sort_order),
    grok_bot_label: row.grok_bot_label || row.name,
    state: row.state,
    last_chirp_at: toIso(row.last_chirp_at),
  };
}

function mapChirp(row: ChirpRow): Chirp {
  return {
    id: row.id,
    bird_id: row.bird_id,
    flock_id: row.flock_id,
    text: row.text,
    source: row.source,
    created_at: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

export async function listPublicFlockCards(): Promise<FlockCard[]> {
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    handle: string;
    title: string;
    bio: string;
    is_seed: boolean;
    bird_count: number;
    last_chirp: string | null;
    last_chirp_at: unknown;
    updated_at: unknown;
  }>`
    select
      f.id,
      f.handle,
      f.title,
      f.bio,
      f.is_seed,
      (select count(*)::int from birds b where b.flock_id = f.id) as bird_count,
      (select c.text from chirps c where c.flock_id = f.id order by c.created_at desc limit 1) as last_chirp,
      (select c.created_at from chirps c where c.flock_id = f.id order by c.created_at desc limit 1) as last_chirp_at,
      f.updated_at
    from flocks f
    where f.visibility = 'public'
      and f.handle not like 'smoke%'
    order by f.is_seed asc, f.updated_at desc
  `;

  const cards: FlockCard[] = rows.map((row) => ({
    id: row.id,
    handle: row.handle,
    title: row.title,
    bio: row.bio ?? "",
    is_seed: Boolean(row.is_seed),
    bird_count: Number(row.bird_count),
    last_chirp: row.last_chirp,
    last_chirp_at: toIso(row.last_chirp_at),
    updated_at: toIso(row.updated_at) ?? new Date().toISOString(),
    birds: [],
  }));

  if (cards.length) {
    const birdRows = await sql<{
      flock_id: string;
      name: string;
      color: string;
      state: BirdState;
    }>`
      select flock_id, name, color, state
      from birds
      order by sort_order asc, name asc
    `;
    const byFlock = new Map<string, FlockCard["birds"]>();
    for (const bird of birdRows) {
      const list = byFlock.get(bird.flock_id) ?? [];
      if (list.length < 6) {
        list.push({ name: bird.name, color: bird.color, state: bird.state });
      }
      byFlock.set(bird.flock_id, list);
    }
    for (const card of cards) {
      card.birds = byFlock.get(card.id) ?? [];
    }
  }

  const real = cards.filter((c) => !c.is_seed);
  const demos = cards.filter((c) => c.is_seed);
  if (real.length >= 8) return real;
  return [...real, ...demos];
}

export async function countClaimedHandles(): Promise<number> {
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from flocks
    where visibility = 'public' and handle not like 'smoke%'
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function getFlockByHandle(handle: string): Promise<Flock | null> {
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql<FlockRow>`
    select id, handle, title, bio, owner_hint, visibility, is_seed, created_at, updated_at
    from flocks where handle = ${handle} limit 1
  `;
  return rows[0] ? mapFlock(rows[0]) : null;
}

export async function getBirdsForFlock(flockId: string): Promise<BirdWithChirp[]> {
  const sql = await getSql();
  const rows = await sql<BirdRow & { last_chirp: string | null }>`
    select
      b.id, b.flock_id, b.name, b.role, b.color, b.sort_order,
      b.grok_bot_label, b.state, b.last_chirp_at,
      (select c.text from chirps c where c.bird_id = b.id order by c.created_at desc limit 1) as last_chirp
    from birds b
    where b.flock_id = ${flockId}
    order by b.sort_order asc, b.name asc
  `;
  return rows.map((row) => ({
    ...mapBird(row),
    last_chirp: row.last_chirp,
  }));
}

export async function getLatestChirp(flockId: string): Promise<Chirp | null> {
  const sql = await getSql();
  const rows = await sql<ChirpRow>`
    select id, bird_id, flock_id, text, source, created_at
    from chirps
    where flock_id = ${flockId}
    order by created_at desc
    limit 1
  `;
  return rows[0] ? mapChirp(rows[0]) : null;
}

export async function getFlockByTokenHash(tokenHash: string): Promise<Flock | null> {
  const sql = await getSql();
  const rows = await sql<FlockRow>`
    select id, handle, title, bio, owner_hint, visibility, is_seed, created_at, updated_at
    from flocks where token_hash = ${tokenHash} limit 1
  `;
  return rows[0] ? mapFlock(rows[0]) : null;
}

export async function getClaimedHandleByTokenHash(tokenHash: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ handle_reserved: string }>`
    select handle_reserved from codes
    where used_at is not null and token_hash = ${tokenHash}
    limit 1
  `;
  return rows[0]?.handle_reserved ?? null;
}

export async function resolveAuthToken(
  token: string,
): Promise<{ flock: Flock | null; handle: string } | null> {
  const tokenHash = hashToken(token);
  const flock = await getFlockByTokenHash(tokenHash);
  if (flock) return { flock, handle: flock.handle };
  const handle = await getClaimedHandleByTokenHash(tokenHash);
  if (handle) return { flock: null, handle };
  return null;
}

export type IncomingBird = {
  name: string;
  role: string;
  grok_bot_label?: string;
};

export async function upsertFlockRoster(input: {
  handle: string;
  tokenHash: string;
  title: string;
  bio: string;
  ownerHint?: string;
  visibility?: Visibility;
  birds: IncomingBird[];
}): Promise<{ flock: Flock; birds: Bird[] }> {
  const sql = await getSql();
  const existing = await sql<FlockRow>`
    select id, handle, title, bio, owner_hint, visibility, is_seed, created_at, updated_at
    from flocks where handle = ${input.handle} limit 1
  `;

  let flockId: string;
  if (existing[0]) {
    flockId = existing[0].id;
    await sql`
      update flocks
      set title = ${input.title},
          bio = ${input.bio},
          owner_hint = ${input.ownerHint ?? existing[0].owner_hint},
          visibility = ${input.visibility ?? existing[0].visibility},
          updated_at = now()
      where id = ${flockId}
    `;
  } else {
    flockId = newId();
    await sql`
      insert into flocks (id, handle, title, bio, owner_hint, token_hash, visibility, is_seed)
      values (
        ${flockId},
        ${input.handle},
        ${input.title},
        ${input.bio},
        ${input.ownerHint ?? null},
        ${input.tokenHash},
        ${input.visibility ?? "public"},
        false
      )
    `;
  }

  const current = await sql<BirdRow>`
    select id, flock_id, name, role, color, sort_order, grok_bot_label, state, last_chirp_at
    from birds where flock_id = ${flockId}
  `;
  const byName = new Map(current.map((b) => [b.name.toLowerCase(), b]));
  const keep = new Set<string>();

  for (const [index, bird] of input.birds.entries()) {
    const key = bird.name.toLowerCase();
    const found = byName.get(key);
    const label = bird.grok_bot_label?.trim() || bird.name;
    if (found) {
      keep.add(found.id);
      await sql`
        update birds
        set role = ${bird.role},
            grok_bot_label = ${label},
            color = ${colorForIndex(index)},
            sort_order = ${index}
        where id = ${found.id}
      `;
    } else {
      const id = newId();
      keep.add(id);
      await sql`
        insert into birds (id, flock_id, name, role, color, sort_order, grok_bot_label, state)
        values (
          ${id},
          ${flockId},
          ${bird.name},
          ${bird.role},
          ${colorForIndex(index)},
          ${index},
          ${label},
          'offline'
        )
      `;
    }
  }

  for (const bird of current) {
    if (!keep.has(bird.id)) {
      await sql`delete from birds where id = ${bird.id}`;
    }
  }

  const flock = await getFlockByHandle(input.handle);
  const birds = await getBirdsForFlock(flockId);
  if (!flock) throw new Error("flock_missing_after_upsert");
  return { flock, birds };
}

export async function updateBirdState(
  flockId: string,
  birdId: string,
  state: BirdState,
): Promise<Bird | null> {
  const sql = await getSql();
  const rows = await sql<BirdRow>`
    update birds
    set state = ${state}
    where id = ${birdId} and flock_id = ${flockId}
    returning id, flock_id, name, role, color, sort_order, grok_bot_label, state, last_chirp_at
  `;
  await sql`update flocks set updated_at = now() where id = ${flockId}`;
  return rows[0] ? mapBird(rows[0]) : null;
}

export async function recentChirpForBird(birdId: string, windowMs: number): Promise<boolean> {
  const sql = await getSql();
  const since = new Date(Date.now() - windowMs).toISOString();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from chirps
    where bird_id = ${birdId} and created_at > ${since}
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function insertChirp(input: {
  bird: Bird;
  text: string;
  source: ChirpSource;
}): Promise<Chirp> {
  const sql = await getSql();
  const id = newId();
  const nextState: BirdState = input.text === "idle" ? "idle" : "working";
  const rows = await sql<ChirpRow>`
    insert into chirps (id, bird_id, flock_id, text, source)
    values (${id}, ${input.bird.id}, ${input.bird.flock_id}, ${input.text}, ${input.source})
    returning id, bird_id, flock_id, text, source, created_at
  `;
  await sql`
    update birds
    set last_chirp_at = now(), state = ${nextState}
    where id = ${input.bird.id}
  `;
  await sql`update flocks set updated_at = now() where id = ${input.bird.flock_id}`;
  return mapChirp(rows[0]!);
}

export async function findBirdInFlock(flockId: string, name: string): Promise<Bird | null> {
  const sql = await getSql();
  const rows = await sql<BirdRow>`
    select id, flock_id, name, role, color, sort_order, grok_bot_label, state, last_chirp_at
    from birds
    where flock_id = ${flockId}
      and (lower(name) = ${name.toLowerCase()} or lower(grok_bot_label) = ${name.toLowerCase()})
    limit 1
  `;
  return rows[0] ? mapBird(rows[0]) : null;
}

export async function getBirdById(id: string): Promise<Bird | null> {
  const sql = await getSql();
  const rows = await sql<BirdRow>`
    select id, flock_id, name, role, color, sort_order, grok_bot_label, state, last_chirp_at
    from birds where id = ${id} limit 1
  `;
  return rows[0] ? mapBird(rows[0]) : null;
}
