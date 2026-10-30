-- Organisers may draft and submit events, but only platform owners may publish them.
alter table public.events add column if not exists review_note text not null default '';

create or replace function private.guard_event_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and not (select private.is_platform_owner()) then
    raise exception 'Only the platform owner can publish an event' using errcode = '42501';
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.guard_event_publication() from public, anon, authenticated;
drop trigger if exists guard_event_publication on public.events;
create trigger guard_event_publication
before insert or update of status on public.events
for each row execute function private.guard_event_publication();

create or replace function public.review_event_publication(
  p_event_id uuid,
  p_decision text,
  p_review_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  if auth.uid() is null or not (select private.is_platform_owner()) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if v_event.status <> 'pending_review' then
    raise exception 'Only events awaiting review can be decided' using errcode = '55000';
  end if;
  update public.events
  set status = case when p_decision = 'approved' then 'published' else 'draft' end,
      published_at = case when p_decision = 'approved' then now() else null end,
      review_note = left(coalesce(p_review_note, ''), 1000),
      updated_at = now()
  where id = p_event_id;
  insert into public.audit_logs(actor_user_id, organizer_id, action, target_type, target_id, metadata)
  values (auth.uid(), v_event.organizer_id, 'event_publication_' || p_decision, 'event', p_event_id,
          jsonb_build_object('title', v_event.title, 'slug', v_event.slug));
  return jsonb_build_object('event_id', p_event_id, 'status', case when p_decision = 'approved' then 'published' else 'draft' end);
end;
$$;
revoke all on function public.review_event_publication(uuid, text, text) from public, anon;
grant execute on function public.review_event_publication(uuid, text, text) to authenticated;
