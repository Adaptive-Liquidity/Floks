-- Forward-fix environments that applied 0007 before poster quota pseudonyms
-- were stored. Existing quota rows inherit the public poster from their
-- earliest persisted Outcome Contract.

alter table outcome_contract_poster_quotas
  add column if not exists poster text;

update outcome_contract_poster_quotas as quota
set poster = contract.poster
from (
  select distinct on (poster_user_id) poster_user_id, poster
  from outcome_contracts
  order by poster_user_id, created_at, id
) as contract
where quota.poster_user_id = contract.poster_user_id
  and quota.poster is null;

alter table outcome_contract_poster_quotas
  alter column poster set not null;

create unique index if not exists outcome_contract_poster_quotas_poster_idx
  on outcome_contract_poster_quotas (poster);
