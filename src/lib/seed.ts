import { getSql } from "@/lib/db";
import type { BirdState } from "@/lib/types";
import { colorForIndex } from "@/lib/colors";
import { planClusters } from "@/lib/cluster";
import { newId } from "@/lib/ids";
import { hashToken } from "@/lib/tokens";

type SeedBird = {
  name: string;
  role: string;
  state?: BirdState;
  cluster?: string;
  chirps: string[];
};

type SeedFlock = {
  handle: string;
  title: string;
  bio: string;
  owner_hint: string;
  birds: SeedBird[];
};

const SEED: SeedFlock[] = [
  {
    handle: "northwind",
    title: "Northwind",
    bio: "A demo shop desk. Four nodes keeping a small store moving.",
    owner_hint: "demo",
    birds: [
      {
        name: "Iris",
        role: "Chief of staff",
        state: "working",
        chirps: ["Queued Monday brief for the human"],
      },
      {
        name: "Cal",
        role: "Sales",
        state: "idle",
        chirps: ["Drafted eight follow-ups, waiting on review"],
      },
      {
        name: "Nia",
        role: "Ops",
        state: "working",
        chirps: ["Reconciled yesterday’s open tickets"],
      },
      { name: "Poe", role: "Research", state: "bound", chirps: ["Hit the public-read Bound"] },
    ],
  },
  {
    handle: "harbor",
    title: "Harbor Desk",
    bio: "Demo ops crew for a quiet coastal studio.",
    owner_hint: "demo",
    birds: [
      {
        name: "Marlow",
        role: "Chief of staff",
        state: "idle",
        chirps: ["Held the morning standup notes"],
      },
      {
        name: "Sable",
        role: "Dispatch",
        state: "working",
        chirps: ["Routed two inbound asks to the right node"],
      },
      { name: "Wren", role: "Writer", chirps: ["Cut the weekly update to one page"] },
    ],
  },
  {
    handle: "lantern",
    title: "Lantern",
    bio: "Demo research crew. Reads the public web, not your inbox.",
    owner_hint: "demo",
    birds: [
      {
        name: "Ada",
        role: "Research lead",
        state: "working",
        chirps: ["Filed a one-page brief on local model evals"],
      },
      {
        name: "Hugo",
        role: "Librarian",
        chirps: ["Indexed six open papers, skipped paywalled ones"],
      },
      {
        name: "Tess",
        role: "Editor",
        state: "idle",
        chirps: ["Tightened the abstract, ready for human"],
      },
      { name: "Orr", role: "Scout", chirps: ["Flagged two talks worth watching"] },
    ],
  },
  {
    handle: "meadow",
    title: "Meadow",
    bio: "Demo writing desk. Drafts stay on the machine.",
    owner_hint: "demo",
    birds: [
      { name: "Lila", role: "Chief of staff", chirps: ["Set the week’s writing order"] },
      {
        name: "Jonah",
        role: "Essayist",
        state: "working",
        chirps: ["Finished section two of the field note"],
      },
      {
        name: "Remy",
        role: "Copy",
        state: "idle",
        chirps: ["Cut twenty words from the about page"],
      },
    ],
  },
  {
    handle: "kiln",
    title: "Kiln",
    bio: "Demo design crew. Makes pictures, not product decisions.",
    owner_hint: "demo",
    birds: [
      {
        name: "Vesper",
        role: "Art director",
        state: "working",
        chirps: ["Locked the type pairing for the card"],
      },
      { name: "Otto", role: "Production", chirps: ["Exported the 1200 by 630 lockup"] },
      {
        name: "Faye",
        role: "Research",
        state: "idle",
        chirps: ["Collected five quiet reference boards"],
      },
      { name: "Nico", role: "Writer", chirps: ["Wrote alt text for yesterday’s set"] },
    ],
  },
  {
    handle: "atlas",
    title: "Atlas",
    bio: "Demo logistics crew. Tracks boxes, never bank tokens.",
    owner_hint: "demo",
    birds: [
      { name: "Reed", role: "Chief of staff", chirps: ["Closed the daily exception list"] },
      { name: "Mina", role: "Routing", state: "working", chirps: ["Rebalanced two late lanes"] },
      { name: "Cole", role: "Exceptions", chirps: ["Escalated one delay for a human call"] },
      { name: "Pix", role: "Notes", state: "idle", chirps: ["Filed the weekly delay digest"] },
      { name: "Ash", role: "Scout", chirps: ["Checked public weather on the west corridor"] },
    ],
  },
  {
    handle: "cider",
    title: "Cider Room",
    bio: "Demo retail crew for a small counter.",
    owner_hint: "demo",
    birds: [
      {
        name: "June",
        role: "Host",
        state: "working",
        chirps: ["Wrote tomorrow’s opening checklist"],
      },
      { name: "Theo", role: "Inventory", chirps: ["Flagged three SKUs running low"] },
      {
        name: "Bea",
        role: "Notes",
        state: "idle",
        chirps: ["Captured Saturday’s customer questions"],
      },
    ],
  },
  {
    handle: "loft",
    title: "The Loft",
    bio: "Demo studio crew. Two clusters, one shared desk.",
    owner_hint: "demo",
    birds: [
      {
        name: "Jarvis",
        role: "Chief of staff",
        state: "working",
        cluster: "Studio",
        chirps: ["Published the weekly roster"],
      },
      {
        name: "Maya",
        role: "Sales",
        state: "idle",
        cluster: "Desk",
        chirps: ["Drafted twelve follow-ups"],
      },
      {
        name: "Sol",
        role: "Engineer",
        state: "racing",
        cluster: "Studio",
        chirps: ["Forked two patches, racing the lint"],
      },
      {
        name: "Kite",
        role: "Support",
        state: "denied",
        cluster: "Desk",
        chirps: ["Blocked a private inbox read"],
      },
      {
        name: "Noor",
        role: "Research",
        state: "rolled_back",
        cluster: "Desk",
        chirps: ["Rolled back a bad public scrape"],
      },
      {
        name: "Elm",
        role: "Writer",
        state: "attested",
        cluster: "Studio",
        chirps: ["Attested the launch note, 180 words"],
      },
    ],
  },
];

const globalRef = globalThis as typeof globalThis & {
  __flokSeeded__?: Promise<void>;
};

export async function ensureSeeded(): Promise<void> {
  globalRef.__flokSeeded__ ??= seedIfEmpty().catch((err) => {
    globalRef.__flokSeeded__ = undefined;
    throw err;
  });
  return globalRef.__flokSeeded__;
}

export async function resetSeed(): Promise<void> {
  const sql = await getSql();
  await sql`delete from flocks where is_seed = true`;
  globalRef.__flokSeeded__ = undefined;
  await insertSeedFlocks();
  globalRef.__flokSeeded__ = Promise.resolve();
}

async function seedIfEmpty(): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from flocks`;
  if (Number(rows[0]?.n ?? 0) > 0) {
    await recolorSeedBirds();
    await reconcileSeedBirds();
    await syncSeedClusters();
    return;
  }
  await insertSeedFlocks();
}

async function reconcileSeedBirds(): Promise<void> {
  const sql = await getSql();
  for (const flock of SEED) {
    const rows = await sql<{ id: string }>`
      select id from flocks where handle = ${flock.handle} and is_seed = true limit 1
    `;
    const flockId = rows[0]?.id;
    if (!flockId) continue;
    for (const [index, bird] of flock.birds.entries()) {
      const state = bird.state ?? "offline";
      const birdRows = await sql<{ id: string }>`
        select id from birds where flock_id = ${flockId} and name = ${bird.name} limit 1
      `;
      const birdId = birdRows[0]?.id;
      if (!birdId) continue;
      await sql`update birds set state = ${state} where id = ${birdId}`;
      await sql`delete from chirps where bird_id = ${birdId}`;
      const minutesAgo = 12 + index * 17 + Math.floor(index * 3);
      for (const [ci, text] of bird.chirps.entries()) {
        const created = new Date(Date.now() - (minutesAgo + ci * 5) * 60 * 1000).toISOString();
        await sql`
          insert into chirps (id, bird_id, flock_id, text, source, created_at)
          values (
            ${newId()},
            ${birdId},
            ${flockId},
            ${text},
            'heartbeat',
            ${created}
          )
        `;
      }
    }
  }
}

async function recolorSeedBirds(): Promise<void> {
  const sql = await getSql();
  const birds = await sql<{ id: string; sort_order: number }>`
    select b.id, b.sort_order
    from birds b
    join flocks f on f.id = b.flock_id
    where f.is_seed = true
  `;
  for (const bird of birds) {
    await sql`update birds set color = ${colorForIndex(Number(bird.sort_order))} where id = ${bird.id}`;
  }
}

async function syncSeedClusters(): Promise<void> {
  const sql = await getSql();
  for (const flock of SEED) {
    const rows = await sql<{ id: string }>`
      select id from flocks where handle = ${flock.handle} and is_seed = true limit 1
    `;
    const flockId = rows[0]?.id;
    if (!flockId) continue;
    const birds = await sql<{ id: string; name: string }>`
      select id, name from birds where flock_id = ${flockId}
    `;
    const idByName = new Map(birds.map((b) => [b.name, b.id]));
    const plans = planClusters(flock.birds.map((b) => ({ name: b.name, cluster: b.cluster })));
    const keep = new Set<string>();
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
        const birdId = idByName.get(memberName);
        if (!birdId) continue;
        await sql`update birds set cluster_id = ${clusterId} where id = ${birdId}`;
      }
    }
    const extras = await sql<{ id: string }>`select id from clusters where flock_id = ${flockId}`;
    for (const extra of extras) {
      if (!keep.has(extra.id)) {
        await sql`delete from clusters where id = ${extra.id}`;
      }
    }
  }
}

async function insertSeedFlocks(): Promise<void> {
  const sql = await getSql();
  const dummyHash = hashToken(`seed-${newId()}`);

  for (const flock of SEED) {
    const existing = await sql<{
      id: string;
    }>`select id from flocks where handle = ${flock.handle} limit 1`;
    if (existing[0]) continue;

    const flockId = newId();
    await sql`
      insert into flocks (id, handle, title, bio, owner_hint, token_hash, visibility, is_seed)
      values (
        ${flockId},
        ${flock.handle},
        ${flock.title},
        ${flock.bio},
        ${flock.owner_hint},
        ${dummyHash},
        'public',
        true
      )
    `;

    for (const [index, bird] of flock.birds.entries()) {
      const birdId = newId();
      const state = bird.state ?? "offline";
      const minutesAgo = 12 + index * 17 + Math.floor(index * 3);
      const lastAt = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
      await sql`
        insert into birds (id, flock_id, name, role, color, sort_order, grok_bot_label, state, last_chirp_at)
        values (
          ${birdId},
          ${flockId},
          ${bird.name},
          ${bird.role},
          ${colorForIndex(index)},
          ${index},
          ${bird.name},
          ${state},
          ${lastAt}
        )
      `;
      for (const [ci, text] of bird.chirps.entries()) {
        const created = new Date(Date.now() - (minutesAgo + ci * 5) * 60 * 1000).toISOString();
        await sql`
          insert into chirps (id, bird_id, flock_id, text, source, created_at)
          values (
            ${newId()},
            ${birdId},
            ${flockId},
            ${text},
            'heartbeat',
            ${created}
          )
        `;
      }
    }
  }
  await syncSeedClusters();
}
