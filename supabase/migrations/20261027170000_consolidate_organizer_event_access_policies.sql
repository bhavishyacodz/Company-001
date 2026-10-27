-- Consolidate organiser-event-access SELECT policies without changing permissions.
-- Platform owners retain all CRUD access; assigned users can read only their own grants.
drop policy if exists organizer_event_access_owner_manage on public.organizer_event_access;
drop policy if exists organizer_event_access_user_read on public.organizer_event_access;

create policy organizer_event_access_select
  on public.organizer_event_access
  for select to authenticated
  using (
    (select private.is_platform_owner())
    or user_id = (select auth.uid())
  );

create policy organizer_event_access_insert_owner
  on public.organizer_event_access
  for insert to authenticated
  with check ((select private.is_platform_owner()));

create policy organizer_event_access_update_owner
  on public.organizer_event_access
  for update to authenticated
  using ((select private.is_platform_owner()))
  with check ((select private.is_platform_owner()));

create policy organizer_event_access_delete_owner
  on public.organizer_event_access
  for delete to authenticated
  using ((select private.is_platform_owner()));
