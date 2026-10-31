-- Owner-only theme workshop. Draft themes are private; only explicitly published themes are public.
begin;

create table public.site_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  description text not null default '',
  category text not null default 'general',
  design jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index site_themes_publication_idx on public.site_themes(status, published_at desc);
alter table public.site_themes enable row level security;

revoke all on table public.site_themes from anon, authenticated;
grant select on table public.site_themes to anon, authenticated;
grant insert, update, delete on table public.site_themes to authenticated;

create policy "published themes are publicly readable"
on public.site_themes for select
to anon, authenticated
using (status = 'published');

create policy "mfa owner can read all themes"
on public.site_themes for select
to authenticated
using ((select private.is_platform_owner_aal2()));

create policy "mfa owner can create themes"
on public.site_themes for insert
to authenticated
with check (
  (select private.is_platform_owner_aal2())
  and created_by = (select auth.uid())
  and status = 'draft'
);

create policy "mfa owner can update themes"
on public.site_themes for update
to authenticated
using ((select private.is_platform_owner_aal2()))
with check ((select private.is_platform_owner_aal2()));

create policy "mfa owner can delete themes"
on public.site_themes for delete
to authenticated
using ((select private.is_platform_owner_aal2()));

create or replace function private.guard_site_theme_publication()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'New themes must start as drafts' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not (select private.is_platform_owner_aal2()) then
      raise exception 'Only an MFA-verified platform owner can publish or archive a theme' using errcode = '42501';
    end if;
    if new.status = 'published' then
      new.published_at := now();
    elsif new.status = 'draft' then
      new.published_at := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create trigger site_themes_guard_publication
before insert or update on public.site_themes
for each row execute function private.guard_site_theme_publication();

commit;
