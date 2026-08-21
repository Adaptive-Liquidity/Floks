-- S2-G2a Phase B: hard-cut the OC outbox to v2 and add staging delivery state.
-- No v1 payload may survive into the staging drainer.

delete from oc_evidence_outbox
where payload->>'schema' is distinct from 'flok.oc-evidence.v2';

alter table oc_evidence_outbox
  add column if not exists deadline_at timestamptz;

update oc_evidence_outbox as outbox
set deadline_at = contract.deadline
from oc_evidence_events as event
join outcome_contracts as contract on contract.id = event.contract_id
where event.event_id = outbox.event_id
  and outbox.deadline_at is null;

alter table oc_evidence_outbox
  alter column deadline_at set not null;

alter table oc_evidence_outbox
  drop constraint if exists oc_evidence_outbox_status_check;

alter table oc_evidence_outbox
  add constraint oc_evidence_outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'dead_letter'));

alter table oc_evidence_outbox
  add column if not exists last_error text,
  add column if not exists dead_lettered_at timestamptz,
  add column if not exists claim_token text;

drop index if exists oc_evidence_outbox_pending_idx;

create index if not exists oc_evidence_outbox_drain_idx
  on oc_evidence_outbox (available_at, created_at)
  where status in ('pending', 'sending');
