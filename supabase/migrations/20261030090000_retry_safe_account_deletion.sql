-- Retry-safe, transactional database phase for organizer account deletion.
-- Private object paths are retained until Storage cleanup is explicitly confirmed.
create table if not exists private.account_deletion_jobs (
  user_id uuid primary key,
  object_paths text[] not null default '{}',
  status text not null default 'storage_pending'
    check (status in ('storage_pending', 'storage_complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.account_deletion_jobs enable row level security;
revoke all on table private.account_deletion_jobs from public, anon, authenticated, service_role;

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns text[]
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_paths text[];
  v_existing private.account_deletion_jobs%rowtype;
  v_organizer_ids uuid[];
  v_event_ids uuid[];
  v_registration_ids uuid[];
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'target user is required' using errcode = '22004';
  end if;

  -- Serialize concurrent retries for the same account so no caller can
  -- observe an empty path list while another request is preparing the job.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select * into v_existing
  from private.account_deletion_jobs
  where user_id = p_user_id
  for update;

  if found then
    return v_existing.object_paths;
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_organizer_ids
  from public.organizers
  where owner_user_id = p_user_id;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_event_ids
  from public.events
  where organizer_id = any(v_organizer_ids);

  select coalesce(array_agg(distinct r.id), '{}'::uuid[])
  into v_registration_ids
  from public.registrations r
  where r.organizer_id = any(v_organizer_ids)
     or r.event_id = any(v_event_ids);

  select coalesce(array_agg(distinct pe.private_object_path), '{}'::text[])
  into v_paths
  from public.payment_evidence pe
  where pe.organizer_id = any(v_organizer_ids)
     or pe.registration_id = any(v_registration_ids);

  insert into private.account_deletion_jobs(user_id, object_paths, status)
  values (p_user_id, v_paths, 'storage_pending');

  -- All relational cleanup below is one PostgreSQL transaction.
  delete from public.payment_evidence
  where organizer_id = any(v_organizer_ids)
     or registration_id = any(v_registration_ids);

  delete from public.registrations
  where id = any(v_registration_ids);

  delete from public.organizer_event_access
  where event_id = any(v_event_ids)
     or user_id = p_user_id
     or granted_by = p_user_id;

  delete from public.audit_logs
  where organizer_id = any(v_organizer_ids);

  delete from public.organizer_applications
  where applicant_user_id = p_user_id;

  update public.organizer_applications
  set reviewed_by = null
  where reviewed_by = p_user_id;

  update public.payment_evidence
  set reviewed_by = null
  where reviewed_by = p_user_id;

  update public.audit_logs
  set actor_user_id = null
  where actor_user_id = p_user_id;

  delete from public.events
  where id = any(v_event_ids);

  delete from public.organizers
  where id = any(v_organizer_ids);

  return v_paths;
end;
$$;

create or replace function public.complete_account_deletion_storage(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private, auth
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  update private.account_deletion_jobs
  set status = 'storage_complete', updated_at = now()
  where user_id = p_user_id;
  return found;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.complete_account_deletion_storage(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
grant execute on function public.complete_account_deletion_storage(uuid) to service_role;
