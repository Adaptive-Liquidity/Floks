import { getSql } from "@/lib/db";
import { mostAlive, planClusters, slugifyCluster } from "@/lib/cluster";
import { colorForIndex } from "@/lib/colors";
import { newId } from "@/lib/ids";
import { planRacks, slugifyRack } from "@/lib/rack";
import { hashToken } from "@/lib/tokens";
import { toIso } from "@/lib/time";
import type {
  Bird,
  BirdState,
  BirdWithChirp,
  Chirp,
  ChirpSource,
  ClusterCard,
  Flock,
  FlockCard,
  RackCard,
  Visibility,
} from "@/lib/types";
import type { RackInput } from "@/lib/rack";

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
  cluster_id: string | null;
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
    cluster_id: row.cluster_id ?? null,
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
      b.id, b.flock_id, b.cluster_id, b.name, b.role, b.color, b.sort_order,
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

export async function getClusterCards(flockId: string): Promise<ClusterCard[]> {
  const sql = await getSql();
  const clusters = await sql<{
    id: string;
    name: string;
    slug: string;
    sort_order: number;
  }>`
    select id, name, slug, sort_order
    from clusters
    where flock_id = ${flockId}
    order by sort_order asc, name asc
  `;
  const birds = await getBirdsForFlock(flockId);
  return clusters.map((cluster) => {
    const members = birds.filter((b) => b.cluster_id === cluster.id);
    const alive = mostAlive(members);
    return {
      id: cluster.id,
      name: cluster.name,
      slug: cluster.slug,
      sort_order: Number(cluster.sort_order),
      node_count: members.length,
      faces: alive.slice(0, 4).map((b) => ({
        name: b.name,
        color: b.color,
        state: b.state,
      })),
      last_chirp_at: members.reduce<string | null>((latest, b) => {
        if (!b.last_chirp_at) return latest;
        if (!latest || b.last_chirp_at > latest) return b.last_chirp_at;
        return latest;
      }, null),
    };
  });
}

export async function getClusterBySlug(flockId: string, slug: string): Promise<ClusterCard | null> {
  const cards = await getClusterCards(flockId);
  return cards.find((c) => c.slug === slug) ?? null;
}

export async function getBirdsForCluster(clusterId: string): Promise<BirdWithChirp[]> {
  const sql = await getSql();
  const rows = await sql<BirdRow & { last_chirp: string | null }>`
    select
      b.id, b.flock_id, b.cluster_id, b.name, b.role, b.color, b.sort_order,
      b.grok_bot_label, b.state, b.last_chirp_at,
      (select c.text from chirps c where c.bird_id = b.id order by c.created_at desc limit 1) as last_chirp
    from birds b
    where b.cluster_id = ${clusterId}
    order by b.sort_order asc, b.name asc
  `;
  return rows.map((row) => ({
    ...mapBird(row),
    last_chirp: row.last_chirp,
  }));
}

export async function getLatestChirpForCluster(clusterId: string): Promise<Chirp | null> {
  const sql = await getSql();
  const rows = await sql<ChirpRow>`
    select c.id, c.bird_id, c.flock_id, c.text, c.source, c.created_at
    from chirps c
    join birds b on b.id = c.bird_id
    where b.cluster_id = ${clusterId}
    order by c.created_at desc
    limit 1
  `;
  return rows[0] ? mapChirp(rows[0]) : null;
}

async function syncFlockClusters(
  flockId: string,
  members: { name: string; id: string; cluster?: string | null }[],
): Promise<void> {
  const sql = await getSql();
  const plans = planClusters(members);
  const keep = new Set<string>();
  const nameToId = new Map(members.map((m) => [m.name, m.id]));

  for (const plan of plans) {
    const existing = await sql<{ id: string }>`
      select id from clusters where flock_id = ${flockId} and slug = ${plan.slug} limit 1
    `;
    const clusterId = existing[0]?.id ?? newId();
    keep.add(clusterId);
    if (existing[0]) {
      await sql`
        update clusters
        set name = ${plan.name}, sort_order = ${plan.sort_order}
        where id = ${clusterId}
      `;
    } else {
      await sql`
        insert into clusters (id, flock_id, name, slug, sort_order)
        values (${clusterId}, ${flockId}, ${plan.name}, ${plan.slug}, ${plan.sort_order})
      `;
    }
    for (const memberName of plan.members) {
      const birdId = nameToId.get(memberName);
      if (!birdId) continue;
      await sql`update birds set cluster_id = ${clusterId} where id = ${birdId}`;
    }
  }

  const extras = await sql<{ id: string }>`
    select id from clusters where flock_id = ${flockId}
  `;
  for (const extra of extras) {
    if (!keep.has(extra.id)) {
      await sql`delete from clusters where id = ${extra.id}`;
    }
  }
  await pruneThinRacks(flockId);
}

export async function getRackCards(flockId: string): Promise<RackCard[]> {
  const sql = await getSql();
  const clusters = await getClusterCards(flockId);
  const byId = new Map(clusters.map((c) => [c.id, c]));
  const racks = await sql<{
    id: string;
    name: string;
    slug: string;
    sort_order: number;
  }>`
    select id, name, slug, sort_order
    from racks
    where flock_id = ${flockId}
    order by sort_order asc, name asc
  `;
  const slots = await sql<{
    rack_id: string;
    cluster_id: string;
    sort_order: number;
  }>`
    select s.rack_id, s.cluster_id, s.sort_order
    from rack_slots s
    join racks r on r.id = s.rack_id
    where r.flock_id = ${flockId}
    order by s.sort_order asc
  `;
  const slotsByRack = new Map<string, { cluster_id: string; sort_order: number }[]>();
  for (const slot of slots) {
    const list = slotsByRack.get(slot.rack_id) ?? [];
    list.push(slot);
    slotsByRack.set(slot.rack_id, list);
  }
  return racks
    .map((rack) => {
      const roosts = (slotsByRack.get(rack.id) ?? [])
        .map((slot) => byId.get(slot.cluster_id))
        .filter((cluster): cluster is ClusterCard => Boolean(cluster));
      return {
        id: rack.id,
        name: rack.name,
        slug: rack.slug,
        sort_order: Number(rack.sort_order),
        roosts,
      };
    })
    .filter((rack) => rack.roosts.length >= 2);
}

export async function getRackBySlug(flockId: string, slug: string): Promise<RackCard | null> {
  const cards = await getRackCards(flockId);
  return cards.find((c) => c.slug === slug) ?? null;
}

export async function pruneThinRacks(flockId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    delete from racks
    where flock_id = ${flockId}
      and (
        select count(*)::int from rack_slots s where s.rack_id = racks.id
      ) < 2
  `;
}

function resolveCluster(cards: ClusterCard[], label: string): ClusterCard | undefined {
  const key = label.trim().toLowerCase();
  const slug = slugifyCluster(label);
  return cards.find((c) => c.slug === key || c.slug === slug || c.name.toLowerCase() === key);
}

export async function upsertFlockRacks(
  flockId: string,
  racks: RackInput[],
): Promise<{ ok: true; racks: RackCard[] } | { ok: false; error: string; code: string }> {
  const planned = planRacks(racks);
  if (!planned.ok) return planned;

  const clusters = await getClusterCards(flockId);
  const resolved: { plan: (typeof planned.plans)[number]; roosts: ClusterCard[] }[] = [];
  for (const plan of planned.plans) {
    const roosts: ClusterCard[] = [];
    for (const label of plan.clusters) {
      const found = resolveCluster(clusters, label);
      if (!found) {
        return {
          ok: false,
          error: `Unknown roost "${label}". Pin clusters that already exist.`,
          code: "cluster_missing",
        };
      }
      if (roosts.some((r) => r.id === found.id)) {
        return {
          ok: false,
          error: "A rack cannot pin the same roost twice.",
          code: "duplicate_roost",
        };
      }
      roosts.push(found);
    }
    resolved.push({ plan, roosts });
  }

  const sql = await getSql();
  const keep = new Set<string>();
  for (const { plan, roosts } of resolved) {
    const existing = await sql<{ id: string }>`
      select id from racks where flock_id = ${flockId} and slug = ${plan.slug} limit 1
    `;
    const rackId = existing[0]?.id ?? newId();
    keep.add(rackId);
    if (existing[0]) {
      await sql`
        update racks
        set name = ${plan.name}, sort_order = ${plan.sort_order}
        where id = ${rackId}
      `;
      await sql`delete from rack_slots where rack_id = ${rackId}`;
    } else {
      await sql`
        insert into racks (id, flock_id, name, slug, sort_order)
        values (${rackId}, ${flockId}, ${plan.name}, ${plan.slug}, ${plan.sort_order})
      `;
    }
    for (const [index, roost] of roosts.entries()) {
      await sql`
        insert into rack_slots (rack_id, cluster_id, sort_order)
        values (${rackId}, ${roost.id}, ${index})
      `;
    }
  }

  const extras = await sql<{ id: string }>`select id from racks where flock_id = ${flockId}`;
  for (const extra of extras) {
    if (!keep.has(extra.id)) {
      await sql`delete from racks where id = ${extra.id}`;
    }
  }

  return { ok: true, racks: await getRackCards(flockId) };
}

export async function upsertOneRack(
  flockId: string,
  rack: RackInput,
): Promise<{ ok: true; racks: RackCard[] } | { ok: false; error: string; code: string }> {
  const planned = planRacks([rack]);
  if (!planned.ok) return planned;
  const current = await getRackCards(flockId);
  const slug = planned.plans[0]?.slug ?? slugifyRack(rack.slug?.trim() || rack.name || "");
  const next = [
    ...current
      .filter((item) => item.slug !== slug)
      .map((item) => ({
        name: item.name,
        slug: item.slug,
        clusters: item.roosts.map((roost) => roost.slug),
      })),
    { ...rack, slug },
  ];
  return upsertFlockRacks(flockId, next);
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
  cluster?: string;
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
    select id, flock_id, cluster_id, name, role, color, sort_order, grok_bot_label, state, last_chirp_at
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
  await syncFlockClusters(
    flockId,
    input.birds.map((bird) => {
      const row = birds.find((b) => b.name.toLowerCase() === bird.name.toLowerCase());
      return { name: bird.name, id: row?.id ?? "", cluster: bird.cluster };
    }),
  );
  return { flock, birds: await getBirdsForFlock(flockId) };
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
    returning id, flock_id, cluster_id, name, role, color, sort_order, grok_bot_label, state, last_chirp_at
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
    select id, flock_id, cluster_id, name, role, color, sort_order, grok_bot_label, state, last_chirp_at
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
    select id, flock_id, cluster_id, name, role, color, sort_order, grok_bot_label, state, last_chirp_at
    from birds where id = ${id} limit 1
  `;
  return rows[0] ? mapBird(rows[0]) : null;
}
