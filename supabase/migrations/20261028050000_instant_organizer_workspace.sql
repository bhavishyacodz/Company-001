-- Activate organiser workspaces immediately; keep owner-only suspension and event publication review.
begin;

-- Allow trusted database-owned activation logic while keeping client-side status changes owner-only.
create or replace function private.enforce_owner_only_organizer_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if current_user = 'postgres' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not coalesce((select private.is_platform_owner()), false) then
      raise exception 'Only trusted workspace activation or the platform owner can create an organiser workspace'
        using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status then
    if not coalesce((select private.is_platform_owner()), false) then
      raise exception 'Only the platform owner can change organiser approval status'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.auto_activate_organizer_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_base text;
  v_slug text;
begin
  new.status := 'approved';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.decision_note := 'Workspace activated automatically; organiser approval is temporarily disabled.';

  v_base := trim(both '-' from left(
    regexp_replace(lower(trim(new.business_name)), '[^a-z0-9]+', '-', 'g'),
    38
  ));
  if v_base = '' then
    v_base := 'organizer';
  end if;
  v_slug := v_base || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.organizers as existing_organizer (owner_user_id, display_name, slug, status)
  values (new.applicant_user_id, new.business_name, v_slug, 'approved')
  on conflict (owner_user_id) do update
    set status = case
      when existing_organizer.status = 'pending' then 'approved'
      else existing_organizer.status
    end;

  return new;
end;
$function$;

revoke all on function public.auto_activate_organizer_application() from public, anon, authenticated;

drop trigger if exists organizer_applications_auto_activate on public.organizer_applications;
create trigger organizer_applications_auto_activate
before insert on public.organizer_applications
for each row execute function public.auto_activate_organizer_application();

drop policy if exists applications_submit_own_pending on public.organizer_applications;
drop policy if exists applications_submit_own_autoactivated on public.organizer_applications;
create policy applications_submit_own_autoactivated
on public.organizer_applications
for insert
to authenticated
with check (
  applicant_user_id = (select auth.uid())
  and status = 'approved'
);

-- Activate workspaces previously blocked only by manual approval.
update public.organizers
set status = 'approved', updated_at = now()
where status = 'pending';

-- Ensure every applicant with a pending/approved application has a workspace.
with latest_application as (
  select distinct on (applicant_user_id)
    applicant_user_id, business_name, id, created_at, status
  from public.organizer_applications
  order by applicant_user_id, created_at desc, id desc
),
normalized as (
  select
    applicant_user_id,
    business_name,
    id,
    status,
    trim(both '-' from left(
      regexp_replace(lower(trim(business_name)), '[^a-z0-9]+', '-', 'g'),
      38
    )) as base_slug
  from latest_application
),
ready as (
  select
    applicant_user_id,
    business_name,
    id,
    coalesce(nullif(base_slug, ''), 'organizer') || '-' ||
      substr(replace(id::text, '-', ''), 1, 8) as organizer_slug
  from normalized
  where status in ('pending', 'approved')
)
insert into public.organizers as existing_organizer (owner_user_id, display_name, slug, status)
select applicant_user_id, business_name, organizer_slug, 'approved'
from ready
on conflict (owner_user_id) do update
  set status = case
    when existing_organizer.status = 'pending' then 'approved'
    else existing_organizer.status
  end;

-- Preserve explicitly rejected applications and suspended organiser accounts.
update public.organizer_applications
set status = 'approved',
    reviewed_by = null,
    reviewed_at = null,
    decision_note = 'Workspace activated automatically; organiser approval is temporarily disabled.'
where status = 'pending';

commit;
