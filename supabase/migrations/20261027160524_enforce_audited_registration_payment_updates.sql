-- Prevent direct client updates from bypassing the audited payment-review RPC.
create or replace function private.guard_registration_review_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.payment_status is distinct from old.payment_status
     or new.registration_status is distinct from old.registration_status then
    if coalesce(current_setting('company001.payment_review_rpc', true), '') <> 'on' then
      raise exception 'Payment and registration status must be changed through the audited review function'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_registration_review_status on public.registrations;
create trigger guard_registration_review_status
before update on public.registrations
for each row execute function private.guard_registration_review_status();

revoke all on function private.guard_registration_review_status() from public, anon, authenticated;

create or replace function public.review_registration_payment(
  p_registration_id uuid,
  p_decision text,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_registration public.registrations%rowtype;
  v_reviewed_evidence integer;
begin
  if auth.uid() is null then
    raise exception 'Sign-in required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;

  select * into v_registration
  from public.registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if not (
    (select private.is_platform_owner())
    or (select private.is_organizer_owner(v_registration.organizer_id))
  ) then
    raise exception 'Owner or registration organiser access required' using errcode = '42501';
  end if;
  if v_registration.payment_status = 'not_required' then
    raise exception 'This registration does not require payment review' using errcode = '22023';
  end if;
  if v_registration.payment_status = 'approved' and p_decision <> 'approved' then
    raise exception 'An approved payment cannot be downgraded; use a separately audited correction process' using errcode = '55000';
  end if;
  if p_decision = 'approved' and not exists (
    select 1
    from public.payment_evidence pe
    where pe.registration_id = p_registration_id
  ) then
    raise exception 'Cannot approve payment without uploaded evidence' using errcode = '23514';
  end if;

  perform set_config('company001.payment_review_rpc', 'on', true);

  update public.registrations
  set payment_status = p_decision,
      registration_status = case when p_decision = 'approved' then 'confirmed' else 'received' end
  where id = p_registration_id;

  update public.payment_evidence
  set review_status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = left(coalesce(p_review_note, ''), 1000)
  where registration_id = p_registration_id;

  get diagnostics v_reviewed_evidence = row_count;
  perform set_config('company001.payment_review_rpc', 'off', true);

  insert into public.audit_logs(actor_user_id, organizer_id, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    v_registration.organizer_id,
    'registration_payment_' || p_decision,
    'registration',
    p_registration_id,
    jsonb_build_object('confirmation_reference', v_registration.confirmation_reference,
                       'evidence_records_updated', v_reviewed_evidence)
  );

  return jsonb_build_object(
    'registration_id', p_registration_id,
    'payment_status', p_decision,
    'registration_status', case when p_decision = 'approved' then 'confirmed' else 'received' end,
    'evidence_records_updated', v_reviewed_evidence
  );
end;
$function$;

revoke all on function public.review_registration_payment(uuid, text, text) from public, anon;
grant execute on function public.review_registration_payment(uuid, text, text) to authenticated, service_role;
