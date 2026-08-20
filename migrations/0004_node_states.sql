-- Node chrome states. `working` stays the API value for executing.
-- Idempotent: add the R2 set as NOT VALID, drop the old check, rename, validate later.

alter table birds add constraint birds_state_check_r2
  check (state in (
    'working',
    'idle',
    'offline',
    'racing',
    'rolled_back',
    'denied',
    'attested',
    'bound'
  )) not valid;
alter table birds drop constraint if exists birds_state_check;
alter table birds rename constraint birds_state_check_r2 to birds_state_check;

-- In a later migration:
-- alter table birds validate constraint birds_state_check;
