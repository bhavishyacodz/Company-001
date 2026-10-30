-- Organisers may review payment state, but must not edit participant identity,
-- event linkage, confirmation references, or other registration fields directly.
-- Row-level security still restricts which registrations each organiser can update.
revoke update on table public.registrations from authenticated;
revoke update (payment_status, registration_status) on table public.registrations from authenticated;
grant update (payment_status, registration_status) on table public.registrations to authenticated;
