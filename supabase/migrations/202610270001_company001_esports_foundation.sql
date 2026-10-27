-- Company-001 / Template 001 foundation
-- Public client access is intentionally narrow. Participant writes and screenshot uploads
-- must go through a validated server-side endpoint in a later step.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  platform_role text not null default 'organizer' check (platform_role in ('organizer', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.platform_role = 'owner'
  );
$$;

create or replace function private.is_organizer_owner(p_organizer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizers o
    where o.id = p_organizer_id
      and o.owner_user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_platform_owner() from public;
revoke all on function private.is_organizer_owner(uuid) from public;
grant execute on function private.is_platform_owner() to authenticated;
grant execute on function private.is_organizer_owner(uuid) to authenticated;

create table public.organizer_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references public.profiles(id) on delete restrict,
  business_name text not null check (length(trim(business_name)) between 2 and 120),
  category text not null default 'esports',
  contact_email text not null,
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers(id) on delete restrict,
  template_key text not null default 'esports-001',
  title text not null check (length(trim(title)) between 2 and 140),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  category text not null default 'esports',
  game_title text not null default '',
  team_format text not null default 'solo_or_squad',
  team_size smallint not null default 1 check (team_size between 1 and 100),
  entry_fee_minor bigint not null default 0 check (entry_fee_minor >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  prize_pool_label text not null default '',
  description text not null default '',
  rules text not null default '',
  starts_at timestamptz,
  registration_closes_at timestamptz,
  payment_instructions text not null default '',
  payment_qr_public_url text not null default '',
  branding jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'closed', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizer_id, slug)
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  organizer_id uuid not null references public.organizers(id) on delete restrict,
  confirmation_reference text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  participant_name text not null check (length(trim(participant_name)) between 2 and 120),
  participant_email text not null,
  game_id text not null default '',
  team_name text not null default '',
  payment_status text not null default 'pending' check (payment_status in ('not_required', 'pending', 'under_review', 'approved', 'rejected')),
  registration_status text not null default 'received' check (registration_status in ('received', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint registrations_event_organizer_match
    foreign key (event_id, organizer_id)
    references public.events(id, organizer_id)
    deferrable initially immediate
);

create table public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  organizer_id uuid not null references public.organizers(id) on delete restrict,
  private_object_path text not null,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  organizer_id uuid references public.organizers(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index organizer_applications_applicant_idx on public.organizer_applications(applicant_user_id, created_at desc);
create index organizers_owner_idx on public.organizers(owner_user_id);
create index events_public_lookup_idx on public.events(status, organizer_id, slug);
create index registrations_organizer_recent_idx on public.registrations(organizer_id, created_at desc);
create index registrations_event_idx on public.registrations(event_id);
create index payment_evidence_registration_idx on public.payment_evidence(registration_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

alter table public.profiles enable row level security;
alter table public.organizer_applications enable row level security;
alter table public.organizers enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.payment_evidence enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.profiles, public.organizer_applications, public.organizers,
  public.events, public.registrations, public.payment_evidence, public.audit_logs
from anon, authenticated;

grant select, insert on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select, insert, update on public.organizer_applications to authenticated;
grant select, insert, update on public.organizers to authenticated;
grant update (display_name, slug, branding) on public.organizers to authenticated;

grant select on public.organizers, public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant select, update on public.registrations to authenticated;
grant update (payment_status, registration_status) on public.registrations to authenticated;
grant select on public.payment_evidence, public.audit_logs to authenticated;

create policy "profiles_read_self_or_owner"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or (select private.is_platform_owner()));

create policy "profiles_insert_self_as_organizer"
on public.profiles for insert
to authenticated
with check (id = (select auth.uid()) and platform_role = 'organizer');

create policy "profiles_update_display_name"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()) and platform_role = 'organizer');

create policy "applications_read_applicant_or_owner"
on public.organizer_applications for select
to authenticated
using (applicant_user_id = (select auth.uid()) or (select private.is_platform_owner()));

create policy "applications_submit_own_pending"
on public.organizer_applications for insert
to authenticated
with check (applicant_user_id = (select auth.uid()) and status = 'pending');

create policy "applications_review_owner_only"
on public.organizer_applications for update
to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

create policy "organizers_read_approved_or_own_or_owner"
on public.organizers for select
to anon, authenticated
using (
  status = 'approved'
  or owner_user_id = (select auth.uid())
  or (select private.is_platform_owner())
);

create policy "organizers_create_owner_only"
on public.organizers for insert
to authenticated
with check ((select private.is_platform_owner()));

create policy "organizers_update_own_profile"
on public.organizers for update
to authenticated
using (owner_user_id = (select auth.uid()) or (select private.is_platform_owner()))
with check (owner_user_id = (select auth.uid()) or (select private.is_platform_owner()));

create policy "events_read_published_or_owner_or_organizer"
on public.events for select
to anon, authenticated
using (
  status = 'published'
  or (select private.is_platform_owner())
  or (select private.is_organizer_owner(organizer_id))
);

create policy "events_create_for_approved_organizer_or_owner"
on public.events for insert
to authenticated
with check (
  (select private.is_platform_owner())
  or (
    (select private.is_organizer_owner(organizer_id))
    and exists (
      select 1 from public.organizers o
      where o.id = organizer_id and o.status = 'approved'
    )
    and status <> 'published'
  )
);

create policy "events_update_own_or_owner"
on public.events for update
to authenticated
using (
  (select private.is_platform_owner())
  or (select private.is_organizer_owner(organizer_id))
)
with check (
  (select private.is_platform_owner())
  or (
    (select private.is_organizer_owner(organizer_id))
    and exists (
      select 1 from public.organizers o
      where o.id = organizer_id and o.status = 'approved'
    )
  )
);

create policy "events_delete_own_or_owner"
on public.events for delete
to authenticated
using (
  (select private.is_platform_owner())
  or (select private.is_organizer_owner(organizer_id))
);

create policy "registrations_read_own_organizer_or_owner"
on public.registrations for select
to authenticated
using (
  (select private.is_platform_owner())
  or (select private.is_organizer_owner(organizer_id))
);

create policy "registrations_update_payment_review_only"
on public.registrations for update
to authenticated
using (
  (select private.is_platform_owner())
  or (select private.is_organizer_owner(organizer_id))
)
with check (
  (select private.is_platform_owner())
  or (select private.is_organizer_owner(organizer_id))
);

create policy "payment_evidence_read_own_organizer_or_owner"
on public.payment_evidence for select
to authenticated
using (
  (select private.is_platform_owner())
  or (select private.is_organizer_owner(organizer_id))
);

create policy "audit_logs_read_owner_only"
on public.audit_logs for select
to authenticated
using ((select private.is_platform_owner()));

comment on table public.registrations is 'Private participant records. Public inserts must use a validated server-side endpoint.';
comment on table public.payment_evidence is 'Private screenshot metadata. Object storage access must be protected separately.';
comment on column public.events.payment_qr_public_url is 'Public QR URL only; never store participant payment evidence in this field.';
comment on column public.profiles.platform_role is 'Owner role must be granted by trusted administration, never by a client request.';
