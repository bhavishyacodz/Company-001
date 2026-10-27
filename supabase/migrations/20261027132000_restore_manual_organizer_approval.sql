-- Restore manual owner approval for new organiser applications.
-- Existing application and organiser records are intentionally left unchanged.

drop trigger if exists organizer_applications_auto_activate
  on public.organizer_applications;

drop function if exists public.auto_activate_organizer_application();

drop policy if exists "applications_submit_own_autoactivated"
  on public.organizer_applications;

create policy "applications_submit_own_pending"
on public.organizer_applications
for insert
to authenticated
with check (
  applicant_user_id = (select auth.uid())
  and status = 'pending'
);
