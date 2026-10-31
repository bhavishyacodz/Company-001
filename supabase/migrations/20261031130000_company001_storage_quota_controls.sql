create table if not exists public.platform_storage_settings (
  id smallint primary key default 1 check (id = 1),
  screenshot_quota_bytes bigint not null default 500000000
    check (screenshot_quota_bytes between 1000000 and 100000000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.platform_storage_settings (id, screenshot_quota_bytes)
values (1, 500000000)
on conflict (id) do nothing;

alter table public.platform_storage_settings enable row level security;
revoke all on table public.platform_storage_settings from anon, authenticated;
grant select, update on table public.platform_storage_settings to authenticated;

drop policy if exists platform_storage_settings_owner_select on public.platform_storage_settings;
create policy platform_storage_settings_owner_select
  on public.platform_storage_settings for select to authenticated
  using ((select private.is_platform_owner()));

drop policy if exists platform_storage_settings_owner_update on public.platform_storage_settings;
create policy platform_storage_settings_owner_update
  on public.platform_storage_settings for update to authenticated
  using ((select private.is_platform_owner()))
  with check ((select private.is_platform_owner()) and updated_by = (select auth.uid()));

-- Serialize screenshot inserts so two simultaneous registrations cannot exceed
-- an organiser's screenshot count, byte quota, or the shared platform budget.
create or replace function private.enforce_payment_evidence_storage_quota()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  organiser_quota bigint;
  max_file_bytes bigint;
  max_file_count integer;
  organiser_used_bytes bigint;
  organiser_used_count bigint;
  platform_used_bytes bigint;
  platform_quota bigint;
begin
  perform pg_advisory_xact_lock(20261031500000001::bigint);

  select storage_quota_bytes, max_screenshot_bytes, max_screenshots
    into organiser_quota, max_file_bytes, max_file_count
  from public.organizers
  where id = new.organizer_id
  for update;

  if organiser_quota is null then
    raise exception 'Organiser storage plan could not be verified.';
  end if;

  if new.file_size_bytes > max_file_bytes then
    raise exception 'Screenshot exceeds the organiser plan file-size limit.';
  end if;

  select count(*), coalesce(sum(file_size_bytes), 0)
    into organiser_used_count, organiser_used_bytes
  from public.payment_evidence
  where organizer_id = new.organizer_id;

  if organiser_used_count >= max_file_count then
    raise exception 'Organiser screenshot count limit reached.';
  end if;

  if organiser_used_bytes + new.file_size_bytes > organiser_quota then
    raise exception 'Organiser screenshot storage quota reached.';
  end if;

  select screenshot_quota_bytes into platform_quota
  from public.platform_storage_settings
  where id = 1;

  if platform_quota is null then platform_quota := 500000000; end if;

  select coalesce(sum(file_size_bytes), 0) into platform_used_bytes
  from public.payment_evidence;

  if platform_used_bytes + new.file_size_bytes > platform_quota then
    raise exception 'Company-001 shared screenshot storage capacity reached.';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_evidence_enforce_storage_quota on public.payment_evidence;
create trigger payment_evidence_enforce_storage_quota
before insert on public.payment_evidence
for each row execute function private.enforce_payment_evidence_storage_quota();