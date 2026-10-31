create table if not exists public.platform_finance_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('income', 'expense')),
  category text not null check (category in ('subscription', 'founding-pilot', 'other-income', 'infrastructure', 'payment-fee', 'refund', 'development', 'other-expense')),
  amount_paise bigint not null check (amount_paise > 0),
  note text not null default '' check (char_length(note) <= 500),
  organizer_id uuid references public.organizers(id) on delete set null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.platform_finance_entries enable row level security;
revoke all on table public.platform_finance_entries from anon, authenticated;
grant select, insert, update, delete on table public.platform_finance_entries to authenticated;

drop policy if exists platform_finance_entries_owner_select on public.platform_finance_entries;
create policy platform_finance_entries_owner_select
  on public.platform_finance_entries for select to authenticated
  using ((select private.is_platform_owner()));

drop policy if exists platform_finance_entries_owner_insert on public.platform_finance_entries;
create policy platform_finance_entries_owner_insert
  on public.platform_finance_entries for insert to authenticated
  with check ((select private.is_platform_owner()) and recorded_by = (select auth.uid()));

drop policy if exists platform_finance_entries_owner_update on public.platform_finance_entries;
create policy platform_finance_entries_owner_update
  on public.platform_finance_entries for update to authenticated
  using ((select private.is_platform_owner()))
  with check ((select private.is_platform_owner()) and recorded_by = (select auth.uid()));

drop policy if exists platform_finance_entries_owner_delete on public.platform_finance_entries;
create policy platform_finance_entries_owner_delete
  on public.platform_finance_entries for delete to authenticated
  using ((select private.is_platform_owner()));

create index if not exists platform_finance_entries_created_at_idx
  on public.platform_finance_entries(created_at desc);
create index if not exists platform_finance_entries_type_created_at_idx
  on public.platform_finance_entries(entry_type, created_at desc);