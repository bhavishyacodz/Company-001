-- Cover foreign-key lookups for event access grants and the user who granted access.
-- These indexes do not change row-level access rules or existing data.
create index if not exists organizer_event_access_event_id_idx
  on public.organizer_event_access (event_id);

create index if not exists organizer_event_access_granted_by_idx
  on public.organizer_event_access (granted_by);
