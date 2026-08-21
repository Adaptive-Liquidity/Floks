-- S2-G2a Phase B review hardening: lease expiry sweep rows across drain requests.

alter table oc_lifecycle
  add column if not exists expiry_claim_token text,
  add column if not exists expiry_claim_until timestamptz;
