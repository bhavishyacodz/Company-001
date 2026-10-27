revoke all on table public.consultation_requests from anon, authenticated, public;
grant select on table public.consultation_requests to authenticated;
grant update (status) on table public.consultation_requests to authenticated;
