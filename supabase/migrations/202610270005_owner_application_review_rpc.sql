-- Owner-only, atomic organiser application review.
create or replace function public.review_organizer_application(
  p_application_id uuid,
  p_decision text,
  p_decision_note text default '',
  p_organizer_slug text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.organizer_applications%rowtype;
  v_slug text;
  v_organizer_id uuid;
begin
  if auth.uid() is null or not (select private.is_platform_owner()) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;

  select * into v_application
  from public.organizer_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_application.status <> 'pending' then
    raise exception 'Application has already been reviewed' using errcode = '55000';
  end if;

  if p_decision = 'approved' then
    if exists (select 1 from public.organizers where owner_user_id = v_application.applicant_user_id) then
      raise exception 'This user already has an organiser workspace' using errcode = '23505';
    end if;
    v_slug := lower(trim(p_organizer_slug));
    if v_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then
      raise exception 'Choose a valid public organiser slug (3-50 lowercase letters, numbers or hyphens)' using errcode = '22023';
    end if;
    insert into public.organizers(owner_user_id, display_name, slug, status)
    values (v_application.applicant_user_id, v_application.business_name, v_slug, 'approved')
    returning id into v_organizer_id;
  end if;

  update public.organizer_applications
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      decision_note = left(coalesce(p_decision_note, ''), 1000)
  where id = p_application_id;

  insert into public.audit_logs(actor_user_id, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    'organizer_application_' || p_decision,
    'organizer_application',
    p_application_id,
    jsonb_build_object('organizer_id', v_organizer_id, 'business_name', v_application.business_name)
  );

  return jsonb_build_object(
    'application_id', p_application_id,
    'status', p_decision,
    'organizer_id', v_organizer_id,
    'organizer_slug', v_slug
  );
end;
$$;

revoke all on function public.review_organizer_application(uuid, text, text, text) from public, anon;
grant execute on function public.review_organizer_application(uuid, text, text, text) to authenticated;
