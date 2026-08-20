-- S2 Gate 1: durable Outcome Contract lifecycle and transactional delivery outbox.
-- Hall remains closed; pending rows have no sender until the upstream decoder is live.

create table if not exists oc_lifecycle (
  contract_id         text primary key,
  latest_event_id     text,
  cluster_id          text,
  cluster_slug        text,
  subject             text,
  current_type        text check (
    current_type is null or current_type in (
      'OC_OPENED', 'OC_AWARDED', 'OC_FULFILLED', 'OC_FAILED', 'OC_SLASHED'
    )
  ),
  current_occurred_at timestamptz,
  updated_at          timestamptz not null default now()
);

create table if not exists oc_evidence_events (
  event_id         text primary key,
  idempotency_key  text not null,
  contract_id      text not null,
  cluster_id       text not null,
  cluster_slug     text not null,
  subject          text not null,
  type             text not null check (
    type in ('OC_OPENED', 'OC_AWARDED', 'OC_FULFILLED', 'OC_FAILED', 'OC_SLASHED')
  ),
  occurred_at      timestamptz not null,
  evidence_hash    text not null,
  capsule_id       text,
  payload          jsonb not null,
  created_at       timestamptz not null default now(),
  unique (contract_id, type, idempotency_key)
);

alter table oc_lifecycle
  drop constraint if exists oc_lifecycle_latest_event_id_fkey;
alter table oc_lifecycle
  add constraint oc_lifecycle_latest_event_id_fkey
  foreign key (latest_event_id) references oc_evidence_events (event_id);

create index if not exists oc_evidence_events_contract_id_idx
  on oc_evidence_events (contract_id, occurred_at);

create table if not exists oc_evidence_outbox (
  event_id      text primary key references oc_evidence_events (event_id) on delete cascade,
  payload       jsonb not null,
  status        text not null default 'pending' check (status in ('pending', 'sent')),
  attempts      integer not null default 0 check (attempts >= 0),
  available_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);

create index if not exists oc_evidence_outbox_pending_idx
  on oc_evidence_outbox (available_at, created_at)
  where status = 'pending';
