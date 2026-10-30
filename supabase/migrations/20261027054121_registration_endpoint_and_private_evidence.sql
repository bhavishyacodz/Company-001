-- Public registration endpoint protection and private evidence storage.
create table public.registration_rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (ip_hash, window_start)
);
alter table public.registration_rate_limits enable row level security;
revoke all on public.registration_rate_limits from anon, authenticated;

create or replace function public.consume_registration_rate_limit(p_ip_hash text, p_window_start timestamptz, p_limit integer default 10)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_count integer;
begin
  insert into public.registration_rate_limits(ip_hash, window_start, request_count)
  values (p_ip_hash, p_window_start, 1)
  on conflict (ip_hash, window_start)
  do update set request_count = public.registration_rate_limits.request_count + 1
  returning request_count into current_count;
  return current_count <= greatest(1, least(p_limit, 30));
end;
$function$;
revoke all on function public.consume_registration_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_registration_rate_limit(text, timestamptz, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-evidence', 'payment-evidence', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "organizer reads their private payment evidence" on storage.objects;
create policy "organizer reads their private payment evidence"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-evidence'
  and exists (
    select 1
    from public.payment_evidence pe
    where pe.private_object_path = storage.objects.name
      and (
        (select private.is_platform_owner())
        or (select private.is_organizer_owner(pe.organizer_id))
      )
  )
);

-- Permit a free-entry or paid-entry eSports event; the organiser's configured fee determines
-- whether a payment screenshot is required by the registration endpoint.
alter table public.events drop constraint if exists esports_events_free_entry_no_cash_prize;
