-- Organizer workspaces activate immediately; event publication review remains separate.
begin;

create or replace function public.auto_activate_organizer_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
begin
  -- Keep the application record for history, but remove the approval gate.
  new.status := 'approved';
  new.reviewed_by := null;
  new.reviewed_at := now();
  new.decision_note := 'Workspace activated automatically; organizer application review is disabled.';

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
$$;

revoke all on function public.auto_activate_organizer_application() from public;

drop trigger if exists organizer_applications_auto_activate on public.organizer_applications;
create trigger organizer_applications_auto_activate
before insert on public.organizer_applications
for each row execute function public.auto_activate_organizer_application();

-- The BEFORE INSERT trigger changes pending to approved before RLS checks the row.
drop policy if exists applications_submit_own_pending on public.organizer_applications;
create policy applications_submit_own_autoactivated
on public.organizer_applications for insert
to authenticated
with check (applicant_user_id = (select auth.uid()) and status = 'approved');

-- Activate workspaces blocked only by the removed approval step.
update public.organizers
set status = 'approved', updated_at = now()
where status = 'pending';

-- Ensure each existing applicant has a workspace, using their most recent application.
with latest_application as (
  select distinct on (applicant_user_id)
    applicant_user_id, business_name, id, created_at
  from public.organizer_applications
  order by applicant_user_id, created_at desc, id desc
),
normalized as (
  select
    applicant_user_id,
    business_name,
    id,
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
)
insert into public.organizers as existing_organizer (owner_user_id, display_name, slug, status)
select applicant_user_id, business_name, organizer_slug, 'approved'
from ready
on conflict (owner_user_id) do update
  set status = case
    when existing_organizer.status = 'pending' then 'approved'
    else existing_organizer.status
  end;

-- Clear pending/rejected states from the retired organizer-approval workflow.
update public.organizer_applications
set status = 'approved',
    reviewed_by = null,
    reviewed_at = coalesce(reviewed_at, now()),
    decision_note = 'Workspace activated automatically; organizer application review is disabled.'
where status <> 'approved';

commit;
