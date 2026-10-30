-- Explicitly document that browser roles must never read or mutate rate-limit counters.
create policy "registration_rate_limits_deny_client_roles"
on public.registration_rate_limits
for all
to anon, authenticated
using (false)
with check (false);
