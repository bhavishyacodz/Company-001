-- Keep the eSports template free-entry and non-cash-reward by design.
-- Generic event payment evidence can be used for appropriate non-gambling event categories.
alter table public.events
  add constraint esports_events_free_entry_no_cash_prize
  check (
    category <> 'esports'
    or (entry_fee_minor = 0 and length(trim(prize_pool_label)) = 0)
  );

-- Cover foreign-key lookups flagged by the Supabase performance advisor.
create index organizer_applications_reviewed_by_idx on public.organizer_applications(reviewed_by);
create index payment_evidence_organizer_idx on public.payment_evidence(organizer_id);
create index payment_evidence_reviewed_by_idx on public.payment_evidence(reviewed_by);
create index audit_logs_actor_user_idx on public.audit_logs(actor_user_id);
create index audit_logs_organizer_idx on public.audit_logs(organizer_id);
create index registrations_event_organizer_pair_idx on public.registrations(event_id, organizer_id);
