-- Enforce owner-only publication transitions at the database boundary.
-- Existing event details remain editable; only transitions into published require the platform owner.
create or replace function private.enforce_event_publication_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      if not coalesce((select private.is_platform_owner()), false) then
        raise exception 'Only the platform owner can publish an event'
          using errcode = '42501';
      end if;
    elsif old.status is distinct from 'published' then
      if not coalesce((select private.is_platform_owner()), false) then
        raise exception 'Only the platform owner can publish an event'
          using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists enforce_event_publication_owner on public.events;
create trigger enforce_event_publication_owner
before insert or update on public.events
for each row execute function private.enforce_event_publication_owner();

revoke all on function private.enforce_event_publication_owner() from public, anon, authenticated;
