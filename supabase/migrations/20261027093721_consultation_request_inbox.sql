create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  email text not null check (char_length(email) between 5 and 254),
  phone text not null default '' check (char_length(phone) <= 40),
  project_type text not null check (project_type in ('business-website','landing-page','web-app','dashboard','event-platform','other')),
  requirements text not null check (char_length(btrim(requirements)) between 15 and 3000),
  preferred_time text not null default '' check (char_length(preferred_time) <= 160),
  status text not null default 'new' check (status in ('new','contacted','qualified','quoted','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultation_requests_created_at_idx
  on public.consultation_requests (created_at desc);
create index if not exists consultation_requests_status_created_at_idx
  on public.consultation_requests (status, created_at desc);

alter table public.consultation_requests enable row level security;

drop policy if exists consultation_requests_owner_read on public.consultation_requests;
create policy consultation_requests_owner_read
  on public.consultation_requests for select to authenticated
  using ((select private.is_platform_owner()));

drop policy if exists consultation_requests_owner_update on public.consultation_requests;
create policy consultation_requests_owner_update
  on public.consultation_requests for update to authenticated
  using ((select private.is_platform_owner()))
  with check ((select private.is_platform_owner()));

create or replace function private.touch_consultation_request_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists consultation_requests_touch_updated_at on public.consultation_requests;
create trigger consultation_requests_touch_updated_at
  before update on public.consultation_requests
  for each row execute function private.touch_consultation_request_updated_at();
