-- Separate platform-owner identity from elevated owner-session authorization.
-- Owners remain excluded from participant/payment data even while at AAL1.
-- Only AAL2 sessions may perform platform-owner administration.
begin;

create or replace function private.is_platform_owner_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select private.is_platform_owner())
    and (select auth.jwt() ->> 'aal') = 'aal2';
$function$;

revoke all on function private.is_platform_owner_aal2() from public, anon;
grant execute on function private.is_platform_owner_aal2() to authenticated, service_role;

-- Owner-only RPC entry points.
create or replace function public.review_event_publication(
  p_event_id uuid,
  p_decision text,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.events%rowtype;
begin
  if auth.uid() is null or not (select private.is_platform_owner_aal2()) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if v_event.status <> 'pending_review' then
    raise exception 'Only events awaiting review can be decided' using errcode = '55000';
  end if;
  update public.events
  set status = case when p_decision = 'approved' then 'published' else 'draft' end,
      published_at = case when p_decision = 'approved' then now() else null end,
      review_note = left(coalesce(p_review_note, ''), 1000),
      updated_at = now()
  where id = p_event_id;
  insert into public.audit_logs(actor_user_id, organizer_id, action, target_type, target_id, metadata)
  values (auth.uid(), v_event.organizer_id, 'event_publication_' || p_decision, 'event', p_event_id,
          jsonb_build_object('title', v_event.title, 'slug', v_event.slug));
  return jsonb_build_object('event_id', p_event_id, 'status', case when p_decision = 'approved' then 'published' else 'draft' end);
end;
$function$;

create or replace function public.review_organizer_application(
  p_application_id uuid,
  p_decision text,
  p_decision_note text default '',
  p_organizer_slug text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_application public.organizer_applications%rowtype;
  v_slug text;
  v_organizer_id uuid;
begin
  if auth.uid() is null or not (select private.is_platform_owner_aal2()) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;

  select * into v_application
  from public.organizer_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_application.status <> 'pending' then
    raise exception 'Application has already been reviewed' using errcode = '55000';
  end if;

  if p_decision = 'approved' then
    if exists (select 1 from public.organizers where owner_user_id = v_application.applicant_user_id) then
      raise exception 'This user already has an organiser workspace' using errcode = '23505';
    end if;
    v_slug := lower(trim(p_organizer_slug));
    if v_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then
      raise exception 'Choose a valid public organiser slug (3-50 lowercase letters, numbers or hyphens)' using errcode = '22023';
    end if;
    insert into public.organizers(owner_user_id, display_name, slug, status)
    values (v_application.applicant_user_id, v_application.business_name, v_slug, 'approved')
    returning id into v_organizer_id;
  end if;

  update public.organizer_applications
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      decision_note = left(coalesce(p_decision_note, ''), 1000)
  where id = p_application_id;

  insert into public.audit_logs(actor_user_id, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    'organizer_application_' || p_decision,
    'organizer_application',
    p_application_id,
    jsonb_build_object('organizer_id', v_organizer_id, 'business_name', v_application.business_name)
  );

  return jsonb_build_object(
    'application_id', p_application_id,
    'status', p_decision,
    'organizer_id', v_organizer_id,
    'organizer_slug', v_slug
  );
end;
$function$;

-- Trigger guards also require AAL2 for privileged owner changes.
create or replace function private.enforce_event_publication_owner()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      if not coalesce((select private.is_platform_owner_aal2()), false) then
        raise exception 'Only the platform owner with verified MFA can publish an event'
          using errcode = '42501';
      end if;
    elsif old.status is distinct from 'published' then
      if not coalesce((select private.is_platform_owner_aal2()), false) then
        raise exception 'Only the platform owner with verified MFA can publish an event'
          using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function private.enforce_owner_only_organizer_status()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if current_user = 'postgres' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not coalesce((select private.is_platform_owner_aal2()), false) then
      raise exception 'Only trusted workspace activation or an MFA-verified platform owner can create an organiser workspace'
        using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status then
    if not coalesce((select private.is_platform_owner_aal2()), false) then
      raise exception 'Only an MFA-verified platform owner can change organiser approval status'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function private.guard_delegated_event_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not (select private.is_platform_owner_aal2()) then
    if old.organizer_id is distinct from new.organizer_id then
      raise exception 'Only an MFA-verified platform owner can transfer an event between organisers' using errcode = '42501';
    end if;
    if old.status is distinct from new.status
       and not (select private.is_organizer_owner(old.organizer_id)) then
      raise exception 'Only the event organiser or MFA-verified platform owner can change event status' using errcode = '42501';
    end if;
    if new.status = 'published' and old.status is distinct from 'published' then
      raise exception 'Events must pass platform-owner publication review' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function private.guard_event_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and not (select private.is_platform_owner_aal2()) then
    raise exception 'Only an MFA-verified platform owner can publish an event' using errcode = '42501';
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
  end if;
  return new;
end;
$function$;

create or replace function private.guard_organizer_access_status()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not (select private.is_platform_owner_aal2()) then
    if old.status is distinct from new.status then
      raise exception 'Only an MFA-verified platform owner can change organiser access status' using errcode = '42501';
    end if;
    if old.owner_user_id is distinct from new.owner_user_id then
      raise exception 'Only an MFA-verified platform owner can transfer organiser ownership' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

-- RLS policies that grant platform-wide administration now require AAL2.
-- Keep private.is_platform_owner() role-only for participant/payment exclusions.
alter policy audit_logs_insert_owner_only on public.audit_logs
  with check ((select private.is_platform_owner_aal2()) and actor_user_id = (select auth.uid()));
alter policy audit_logs_read_owner_only on public.audit_logs
  using ((select private.is_platform_owner_aal2()));

alter policy consultation_requests_owner_read on public.consultation_requests
  using ((select private.is_platform_owner_aal2()));
alter policy consultation_requests_owner_update on public.consultation_requests
  using ((select private.is_platform_owner_aal2()))
  with check ((select private.is_platform_owner_aal2()));

alter policy events_create_for_approved_organizer_or_owner on public.events
  with check (
    (select private.is_platform_owner_aal2())
    or (
      (select private.is_organizer_owner(events.organizer_id))
      and exists (select 1 from public.organizers o where o.id = events.organizer_id and o.status = 'approved')
      and status <> 'published'
    )
  );
alter policy events_delete_own_or_owner on public.events
  using (
    (select private.is_platform_owner_aal2())
    or (
      (select private.is_organizer_owner(events.organizer_id))
      and exists (select 1 from public.organizers o where o.id = events.organizer_id and o.status = 'approved')
    )
  );
alter policy events_read_published_or_owner_or_organizer on public.events
  using (
    status = 'published'
    or (select private.is_platform_owner_aal2())
    or (select private.can_access_event(events.id))
  );
alter policy events_update_own_or_owner on public.events
  using (
    (select private.is_platform_owner_aal2())
    or (select private.can_edit_event(events.id))
  )
  with check (
    (select private.is_platform_owner_aal2())
    or (
      (select private.can_edit_event(events.id))
      and exists (select 1 from public.organizers o where o.id = events.organizer_id and o.status = 'approved')
    )
  );

alter policy applications_read_applicant_or_owner on public.organizer_applications
  using (
    applicant_user_id = (select auth.uid())
    or (select private.is_platform_owner_aal2())
  );
alter policy applications_review_owner_only on public.organizer_applications
  using ((select private.is_platform_owner_aal2()))
  with check ((select private.is_platform_owner_aal2()));

alter policy organizer_event_access_delete_owner on public.organizer_event_access
  using ((select private.is_platform_owner_aal2()));
alter policy organizer_event_access_insert_owner on public.organizer_event_access
  with check ((select private.is_platform_owner_aal2()));
alter policy organizer_event_access_select on public.organizer_event_access
  using (
    (select private.is_platform_owner_aal2())
    or user_id = (select auth.uid())
  );
alter policy organizer_event_access_update_owner on public.organizer_event_access
  using ((select private.is_platform_owner_aal2()))
  with check ((select private.is_platform_owner_aal2()));

alter policy organizers_create_owner_only on public.organizers
  with check ((select private.is_platform_owner_aal2()));
alter policy organizers_read_own_or_owner on public.organizers
  using (
    status = 'approved'
    or owner_user_id = (select auth.uid())
    or (select private.is_platform_owner_aal2())
  );
alter policy organizers_update_own_profile on public.organizers
  using (
    owner_user_id = (select auth.uid())
    or (select private.is_platform_owner_aal2())
  )
  with check (
    owner_user_id = (select auth.uid())
    or (select private.is_platform_owner_aal2())
  );

alter policy profiles_read_self_or_owner on public.profiles
  using (
    id = (select auth.uid())
    or (select private.is_platform_owner_aal2())
  );

commit;
