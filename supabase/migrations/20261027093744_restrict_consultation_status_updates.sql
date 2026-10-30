
revoke update on public.consultation_requests from authenticated;
grant update (status) on public.consultation_requests to authenticated;
create or replace function private.touch_consultation_request_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists consultation_requests_touch_updated_at on public.consultation_requests;
create trigger consultation_requests_touch_updated_at
before update on public.consultation_requests
for each row execute function private.touch_consultation_request_updated_at();
