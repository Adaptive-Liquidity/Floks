-- Clusters: named subgroups of Nodes (≤12 live tiles per roost).
-- Internal bird/chirp names stay. Idempotent.

create table if not exists clusters (
  id          text primary key,
  flock_id    text not null references flocks (id) on delete cascade,
  name        text not null,
  slug        text not null,
  sort_order  integer not null default 0,
  unique (flock_id, slug)
);

create index if not exists clusters_flock_id_idx on clusters (flock_id);

alter table birds
  add column if not exists cluster_id text references clusters (id) on delete set null;

create index if not exists birds_cluster_id_idx on birds (cluster_id);

insert into clusters (id, flock_id, name, slug, sort_order)
select 'crew-' || f.id, f.id, 'Crew', 'crew', 0
from flocks f
where not exists (select 1 from clusters c where c.flock_id = f.id);

update birds b
set cluster_id = c.id
from clusters c
where c.flock_id = b.flock_id
  and c.slug = 'crew'
  and b.cluster_id is null;
