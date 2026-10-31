begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000003',
  'authenticated', 'authenticated', 'owner-mfa-test@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
) on conflict (id) do nothing;

insert into public.profiles (id, display_name, platform_role)
values ('10000000-0000-4000-8000-000000000003', 'MFA Test Owner', 'owner')
on conflict (id) do update set platform_role = excluded.platform_role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  private.is_platform_owner(),
  true,
  'owner with aal1 remains a platform owner for privacy exclusions'
);
select is(
  private.is_platform_owner_aal2(),
  false,
  'owner with aal1 cannot pass elevated owner authorization'
);
select throws_ok(
  $$select public.review_event_publication('30000000-0000-4000-8000-000000000099'::uuid, 'approved', '')$$,
  '42501',
  'Owner access required',
  'owner with aal1 cannot execute an owner-only review action'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  private.is_platform_owner_aal2(),
  true,
  'owner with aal2 can pass elevated owner authorization'
);
select throws_ok(
  $$select public.review_event_publication('30000000-0000-4000-8000-000000000099'::uuid, 'approved', '')$$,
  'P0002',
  'Event not found',
  'owner with aal2 passes authorization and reaches the event lookup'
);

select * from finish();
rollback;
