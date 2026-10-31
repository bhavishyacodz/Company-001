-- Suspended or banned accounts must lose access immediately at the RLS boundary,
-- including already-issued access tokens and previously delegated event access.
begin;

create or replace function private.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from auth.users u
    where u.id = (select auth.uid())
      and (u.banned_until is null or u.banned_until <= now())
      and coalesce(u.raw_app_meta_data ->> 'account_suspended', 'false') <> 'true'
  );
$function$;

revoke all on function private.is_active_account() from public, anon;
grant execute on function private.is_active_account() to authenticated;

create or replace function public.is_account_active_for_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth
as $function$
  select p_user_id is not null and exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and (u.banned_until is null or u.banned_until <= now())
      and coalesce(u.raw_app_meta_data ->> 'account_suspended', 'false') <> 'true'
  );
$function$;

-- This lookup is needed only by trusted service-role Edge Functions that
-- create signed URLs or accept public registrations for an organizer.
revoke all on function public.is_account_active_for_user(uuid) from public, anon, authenticated;
grant execute on function public.is_account_active_for_user(uuid) to service_role;

create or replace function private.is_organizer_owner(p_organizer_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select private.is_active_account())
    and exists (
      select 1 from public.organizers o
      where o.id = p_organizer_id
        and o.owner_user_id = (select auth.uid())
    );
$function$;

create or replace function private.can_access_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select private.is_active_account())
    and exists (
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
              where a.event_id = e.id
                and a.user_id = (select auth.uid())
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
set search_path to ''
as $function$
  select (select private.is_active_account())
    and exists (
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
              where a.event_id = e.id
                and a.user_id = (select auth.uid())
                and a.access_level = 'editor'
            )
          )
        )
    );
$function$;

drop policy if exists registrations_read_own_organizer_only on public.registrations;
create policy registrations_read_own_organizer_only
on public.registrations for select to authenticated
using (
  (select private.is_active_account())
  and not (select private.is_platform_owner())
  and (select private.can_access_event(registrations.event_id))
  and exists (
    select 1 from public.organizers o
    where o.id = registrations.organizer_id
      and o.owner_user_id = (select auth.uid())
      and o.status = 'approved'
  )
);

drop policy if exists payment_evidence_read_own_organizer_only on public.payment_evidence;
create policy payment_evidence_read_own_organizer_only
on public.payment_evidence for select to authenticated
using (
  (select private.is_active_account())
  and not (select private.is_platform_owner())
  and exists (
    select 1 from public.organizers o
    where o.id = payment_evidence.organizer_id
      and o.owner_user_id = (select auth.uid())
      and o.status = 'approved'
  )
);

drop policy if exists "organizer reads only their own private payment evidence" on storage.objects;
create policy "organizer reads only their own private payment evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-evidence'
  and (select private.is_active_account())
  and not (select private.is_platform_owner())
  and exists (
    select 1
    from public.payment_evidence pe
    join public.organizers o on o.id = pe.organizer_id
    where pe.private_object_path = objects.name
      and o.owner_user_id = (select auth.uid())
      and o.status = 'approved'
  )
);

commit;
