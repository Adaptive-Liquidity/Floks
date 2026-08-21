-- S2-G2a Phase B review hardening: keep poison expiry rows from starving the sweep.

alter table oc_lifecycle
  add column if not exists expiry_retry_at timestamptz,
  add column if not exists expiry_last_error text,
  add column if not exists expiry_attempts integer not null default 0,
  add column if not exists expiry_dead_lettered_at timestamptz;

create index if not exists oc_lifecycle_expiry_sweep_idx
  on oc_lifecycle (current_type, expiry_retry_at)
  where current_type in ('OC_OPENED', 'OC_AWARDED')
    and expiry_dead_lettered_at is null;

create index if not exists outcome_contracts_deadline_idx
  on outcome_contracts (deadline);
