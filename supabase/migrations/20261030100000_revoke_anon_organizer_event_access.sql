-- Anonymous visitors do not use organizer delegation records.
-- Keep all organizer_event_access access behind authenticated owner policies.
revoke all privileges on table public.organizer_event_access from anon;
