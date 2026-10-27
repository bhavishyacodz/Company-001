-- Organiser status is an approval/suspension control, not a self-service profile field.
-- Only a platform owner may create or change privileged organiser status.
create or replace function private.enforce_owner_only_organizer_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if not coalesce((select private.is_platform_owner()), false) then
      raise exception 'Only the platform owner can create an organiser workspace'
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

drop trigger if exists enforce_owner_only_organizer_status on public.organizers;
create trigger enforce_owner_only_organizer_status
before insert or update on public.organizers
for each row execute function private.enforce_owner_only_organizer_status();

revoke all on function private.enforce_owner_only_organizer_status() from public, anon, authenticated;
