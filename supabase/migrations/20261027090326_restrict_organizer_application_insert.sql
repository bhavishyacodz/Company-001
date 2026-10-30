-- Applicants may submit application details, but cannot forge review metadata.
-- The status column defaults to 'pending'; review fields are written only by the owner RPC.
revoke insert on table public.organizer_applications from authenticated;
revoke insert (
  id,
  applicant_user_id,
  business_name,
  category,
  contact_email,
  notes,
  status,
  reviewed_by,
  reviewed_at,
  decision_note,
  created_at
) on table public.organizer_applications from authenticated;

grant insert (
  applicant_user_id,
  business_name,
  category,
  contact_email,
  notes
) on table public.organizer_applications to authenticated;
