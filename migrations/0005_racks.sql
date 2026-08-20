-- Racks: pin 2–4 roosts on one page (a shift). Contract racks wait on Hall.
-- Internal bird/chirp names stay. Idempotent.

create table if not exists racks (
  id          text primary key,
  flock_id    text not null references flocks (id) on delete cascade,
  name        text not null,
  slug        text not null,
  sort_order  integer not null default 0,
  unique (flock_id, slug)
);

create index if not exists racks_flock_id_idx on racks (flock_id);

create table if not exists rack_slots (
  rack_id     text not null references racks (id) on delete cascade,
  cluster_id  text not null references clusters (id) on delete cascade,
  sort_order  integer not null default 0,
  primary key (rack_id, cluster_id)
);

create index if not exists rack_slots_cluster_id_idx on rack_slots (cluster_id);
