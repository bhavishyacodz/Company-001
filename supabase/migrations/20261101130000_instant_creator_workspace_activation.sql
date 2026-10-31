-- Activate a creator's internal organiser ownership record on their first Create site action.
-- This removes the application/review screen from creator onboarding while retaining
-- owner-controlled suspension and owner-only event publication review.
begin;

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
  new.decision_note := 'Workspace activated automatically; organiser approval is disabled.';

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

commit;
