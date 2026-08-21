-- E1: persistent Outcome Contract headers.
-- This is intentionally pre-market: no bids, award, escrow, settlement, or SPX egress.

create table if not exists outcome_contracts (
  id                  text primary key,
  poster_user_id      text not null,
  poster              text not null,
  outcome_class       text not null
                      check (outcome_class in ('artifact', 'dataset', 'transaction', 'attestation')),
  outcome_text        text not null,
  proof_requirements  jsonb not null,
  deadline            timestamptz not null,
  bound               jsonb not null,
  visibility          text not null default 'public'
                      check (visibility in ('public', 'unlisted')),
  status              text not null default 'open'
                      check (status in ('open')),
  version             integer not null default 1 check (version > 0),
  contract_hash       text not null unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists outcome_contract_poster_quotas (
  poster_user_id  text primary key,
  poster          text not null unique,
  contract_count  integer not null default 0
                  check (contract_count between 0 and 100)
);

create index if not exists outcome_contracts_poster_user_idx
  on outcome_contracts (poster_user_id, created_at desc);

create index if not exists outcome_contracts_public_idx
  on outcome_contracts (created_at desc)
  where visibility = 'public';
