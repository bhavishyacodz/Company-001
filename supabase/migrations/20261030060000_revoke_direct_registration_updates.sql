-- Remove legacy direct-update grants as a second layer behind RLS.
-- All participant/payment state changes must go through the audited RPC.
begin;

revoke update on table public.registrations from authenticated;
revoke update (payment_status, registration_status) on table public.registrations from authenticated;

commit;
