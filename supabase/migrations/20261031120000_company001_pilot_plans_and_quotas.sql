-- Company-001 pilot plans and enforceable screenshot/form quotas.
-- Free pilot: 10 organisers, 40 screenshots each, 1 MB per screenshot.
-- The 500 MB shared cap leaves a 100 MB reserve against the 1 GB Free bucket.
alter table public.organizers
  add column if not exists plan_key text not null default 'free',
  add column if not exists storage_quota_bytes bigint not null default 40000000,
  add column if not exists max_screenshot_bytes bigint not null default 1000000,
  add column if not exists max_screenshots integer not null default 40,
  add column if not exists max_forms integer not null default 1,
  add column if not exists max_responses_per_form integer not null default 100,
  add column if not exists plan_activated_at timestamptz;

alter table public.organizers
  add constraint organizers_plan_key_check
  check (plan_key in ('free', 'starter', 'business'));

alter table public.organizers
  add constraint organizers_plan_limits_positive
  check (
    storage_quota_bytes > 0
    and max_screenshot_bytes > 0
    and max_screenshots > 0
    and max_forms > 0
    and max_responses_per_form > 0
  );

alter table public.payment_evidence
  add column if not exists file_size_bytes bigint;

-- Backfill known object sizes where Storage metadata is available. Unknown legacy
-- objects are counted conservatively as 1 MB so old uploads cannot bypass quotas.
update public.payment_evidence as evidence
set file_size_bytes = case
  when (objects.metadata ->> 'size') ~ '^[0-9]+$'
    then (objects.metadata ->> 'size')::bigint
  else 1000000
end
from storage.objects as objects
where objects.bucket_id = 'payment-evidence'
  and objects.name = evidence.private_object_path
  and evidence.file_size_bytes is null;

update public.payment_evidence
set file_size_bytes = 1000000
where file_size_bytes is null;

alter table public.payment_evidence
  alter column file_size_bytes set default 1000000,
  alter column file_size_bytes set not null,
  add constraint payment_evidence_file_size_positive check (file_size_bytes > 0);

create index if not exists payment_evidence_organizer_file_size_idx
  on public.payment_evidence(organizer_id, file_size_bytes);

-- Only the platform owner can change paid-plan entitlements. Organisers may
-- still update their ordinary workspace profile fields under existing policies.
create or replace function private.guard_organizer_plan_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    new.plan_key is distinct from old.plan_key
    or new.storage_quota_bytes is distinct from old.storage_quota_bytes
    or new.max_screenshot_bytes is distinct from old.max_screenshot_bytes
    or new.max_screenshots is distinct from old.max_screenshots
    or new.max_forms is distinct from old.max_forms
    or new.max_responses_per_form is distinct from old.max_responses_per_form
    or new.plan_activated_at is distinct from old.plan_activated_at
  ) and not private.is_platform_owner() then
    raise exception 'Only the platform owner can change organiser plan limits.';
  end if;
  return new;
end;
$$;

drop trigger if exists organizers_guard_plan_fields on public.organizers;
create trigger organizers_guard_plan_fields
before update on public.organizers
for each row execute function private.guard_organizer_plan_fields();

-- Keep the free pilot to ten workspaces. Moving an organiser off Free releases
-- a pilot slot; a new Free workspace cannot be created beyond the first ten.
create or replace function private.enforce_free_organizer_pilot_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  free_count integer;
begin
  if new.plan_key = 'free'
    and (tg_op = 'INSERT' or old.plan_key is distinct from 'free') then
    select count(*) into free_count
    from public.organizers
    where plan_key = 'free'
      and (tg_op = 'INSERT' or id <> new.id);
    if free_count >= 10 then
      raise exception 'The ten free pilot organiser slots are full. Request a paid plan or contact Company-001.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists organizers_enforce_free_pilot_limit on public.organizers;
create trigger organizers_enforce_free_pilot_limit
before insert or update of plan_key on public.organizers
for each row execute function private.enforce_free_organizer_pilot_limit();

-- Enforce form count in the database, not only in the browser.
create or replace function private.enforce_organizer_form_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed_forms integer;
  existing_forms integer;
begin
  select max_forms into allowed_forms
  from public.organizers
  where id = new.organizer_id;

  if allowed_forms is null then
    raise exception 'Organiser plan could not be verified.';
  end if;

  select count(*) into existing_forms
  from public.events
  where organizer_id = new.organizer_id;

  if existing_forms >= allowed_forms then
    raise exception 'Your current plan allows up to % form(s). Request a plan upgrade to create another form.', allowed_forms;
  end if;

  return new;
end;
$$;

drop trigger if exists events_enforce_organizer_form_limit on public.events;
create trigger events_enforce_organizer_form_limit
before insert on public.events
for each row execute function private.enforce_organizer_form_limit();
