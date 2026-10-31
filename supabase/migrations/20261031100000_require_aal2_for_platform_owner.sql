-- Require a verified second factor for every platform-owner authorization check.
-- This applies to existing owner accounts too; normal organizer access is unchanged.
begin;

create or replace function private.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.platform_role = 'owner'
    );
$function$;

revoke all on function private.is_platform_owner() from public, anon;
grant execute on function private.is_platform_owner() to authenticated, service_role;

commit;
