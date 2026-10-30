
revoke all on public.consultation_requests from anon, authenticated, public;
grant select on public.consultation_requests to authenticated;
grant update (status) on public.consultation_requests to authenticated;
