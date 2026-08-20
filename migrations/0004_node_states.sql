-- Node chrome states. `working` stays the API value for executing.
-- Idempotent: drop the v0 check, add the R2 set.

alter table birds drop constraint if exists birds_state_check;

alter table birds add constraint birds_state_check
  check (state in (
    'working',
    'idle',
    'offline',
    'racing',
    'rolled_back',
    'denied',
    'attested',
    'bound'
  ));
