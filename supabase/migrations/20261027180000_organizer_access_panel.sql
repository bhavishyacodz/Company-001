-- Organiser access panel: event-scoped grants and owner-managed suspension.
-- Additive only: preserve existing accounts, events, and records.
create table if not exists public.organizer_event_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  access_level text not null default 'editor' check (access_level in ('viewer','editor')),
  granted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create index if not exists organizer_event_access_user_event_idx
  on public.organizer_event_access(user_id, event_id);
alter table public.organizer_event_access enable row level security;

drop policy if exists organizer_event_access_owner_manage on public.organizer_event_access;
create policy organizer_event_access_owner_manage
  on public.organizer_event_access for all to authenticated
  using ((select private.is_platform_owner()))
  with check ((select private.is_platform_owner()));
drop policy if exists organizer_event_access_user_read on public.organizer_event_access;
create policy organizer_event_access_user_read
  on public.organizer_event_access for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.can_access_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.events e
    join public.organizers o on o.id = e.organizer_id
    where e.id = p_event_id
      and o.status = 'approved'
      and (
        o.owner_user_id = (select auth.uid())
        or (
          exists (
            select 1 from public.organizers grantee
            where grantee.owner_user_id = (select auth.uid())
              and grantee.status = 'approved'
          )
          and exists (
            select 1 from public.organizer_event_access a
            where a.event_id = e.id and a.user_id = (select auth.uid())
          )
        )
      )
  );
$function$;

create or replace function private.can_edit_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.events e
    join public.organizers o on o.id = e.organizer_id
    where e.id = p_event_id
      and o.status = 'approved'
      and (
        o.owner_user_id = (select auth.uid())
        or (
          exists (
            select 1 from public.organizers grantee
            where grantee.owner_user_id = (select auth.uid())
              and grantee.status = 'approved'
          )
          and exists (
            select 1 from public.organizer_event_access a
            where a.event_id = e.id and a.user_id = (select auth.uid())
              and a.access_level = 'editor'
          )
        )
      )
  );
$function$;

-- Keep published events public; drafts are visible only to their owner, assigned users, or platform owner.
drop policy if exists events_read_published_or_owner_or_organizer on public.events;
create policy events_read_published_or_owner_or_organizer
  on public.events for select to authenticated
  using (
    status = 'published'
    or (select private.is_platform_owner())
    or (select private.can_access_event(id))
  );

drop policy if exists events_update_own_or_owner on public.events;
create policy events_update_own_or_owner
  on public.events for update to authenticated
  using ((select private.is_platform_owner()) or (select private.can_edit_event(id)))
  with check (
    (select private.is_platform_owner())
    or (
      (select private.can_edit_event(id))
      and exists (select 1 from public.organizers o where o.id = organizer_id and o.status = 'approved')
    )
  );

drop policy if exists events_delete_own_or_owner on public.events;
create policy events_delete_own_or_owner
  on public.events for delete to authenticated
  using (
    (select private.is_platform_owner())
    or (
      (select private.is_organizer_owner(organizer_id))
      and exists (
        select 1 from public.organizers o
        where o.id = events.organizer_id and o.status = 'approved'
      )
    )
  );

drop policy if exists registrations_read_own_organizer_or_owner on public.registrations;
create policy registrations_read_own_organizer_or_owner
  on public.registrations for select to authenticated
  using (
    (select private.is_platform_owner())
    or (select private.can_access_event(event_id))
  );

-- Keep direct registration-row updates limited to the platform owner and the event's own organiser.
-- Delegated users can read assigned registrations, but payment/status changes stay behind the audited RPC.
drop policy if exists registrations_update_payment_review_only on public.registrations;
create policy registrations_update_payment_review_only
  on public.registrations for update to authenticated
  using (
    (select private.is_platform_owner())
    or (select private.is_organizer_owner(organizer_id))
  )
  with check (
    (select private.is_platform_owner())
    or (select private.is_organizer_owner(organizer_id))
  );

drop policy if exists payment_evidence_read_own_organizer_or_owner on public.payment_evidence;
create policy payment_evidence_read_own_organizer_or_owner
  on public.payment_evidence for select to authenticated
  using (
    (select private.is_platform_owner())
    or exists (
      select 1 from public.organizers o
      where o.id = payment_evidence.organizer_id
        and o.owner_user_id = (select auth.uid())
        and o.status = 'approved'
    )
  );

-- Record owner actions without exposing audit rows to organisers.
drop policy if exists audit_logs_insert_owner_only on public.audit_logs;
create policy audit_logs_insert_owner_only
  on public.audit_logs for insert to authenticated
  with check ((select private.is_platform_owner()) and actor_user_id = (select auth.uid()));

grant select, insert, update, delete on public.organizer_event_access to authenticated;
revoke all on function private.can_access_event(uuid) from public;
revoke all on function private.can_edit_event(uuid) from public;
grant execute on function private.can_access_event(uuid) to authenticated;
grant execute on function private.can_edit_event(uuid) to authenticated;


-- Delegated editors must not transfer event ownership or bypass manual publication review.
create or replace function private.guard_delegated_event_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not (select private.is_platform_owner()) then
    if old.organizer_id is distinct from new.organizer_id then
      raise exception 'Only the platform owner can transfer an event between organisers'
        using errcode = '42501';
    end if;
    -- A delegated editor may edit event content, but cannot delete the event,
    -- change its publication status, or bypass the platform-owner review.
    if old.status is distinct from new.status
       and not (select private.is_organizer_owner(old.organizer_id)) then
      raise exception 'Only the event organiser or platform owner can change event status'
        using errcode = '42501';
    end if;
    if new.status = 'published' and old.status is distinct from 'published' then
      raise exception 'Events must pass platform-owner publication review'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_delegated_event_update on public.events;
create trigger guard_delegated_event_update
before update on public.events
for each row execute function private.guard_delegated_event_update();


-- Prevent an organiser from self-approving or undoing an owner suspension through direct API calls.
create or replace function private.guard_organizer_access_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not (select private.is_platform_owner()) then
    if old.status is distinct from new.status then
      raise exception 'Only the platform owner can change organiser access status'
        using errcode = '42501';
    end if;
    if old.owner_user_id is distinct from new.owner_user_id then
      raise exception 'Only the platform owner can transfer organiser ownership'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_organizer_access_status on public.organizers;
create trigger guard_organizer_access_status
before update on public.organizers
for each row execute function private.guard_organizer_access_status();
