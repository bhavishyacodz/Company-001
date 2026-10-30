begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

-- Entirely synthetic fixture data. This suite runs only against the local Supabase
-- Production-ledger-aligned migrations are replayed before this suite in CI.
-- database created by GitHub Actions; it never connects to the production project.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'privacy-organizer-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'privacy-organizer-b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'privacy-platform-owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name, platform_role) values
  ('10000000-0000-4000-8000-000000000001', 'Privacy Test Organizer A', 'organizer'),
  ('10000000-0000-4000-8000-000000000002', 'Privacy Test Organizer B', 'organizer'),
  ('10000000-0000-4000-8000-000000000003', 'Privacy Test Platform Owner', 'owner')
on conflict (id) do update set
  display_name = excluded.display_name,
  platform_role = excluded.platform_role;

insert into public.organizers (id, owner_user_id, display_name, slug, status) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Privacy Organizer A', 'privacy-organizer-a', 'approved'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Privacy Organizer B', 'privacy-organizer-b', 'approved');

-- The production policy allows only the platform owner to publish events.
-- Seed published test events under that owner's simulated JWT identity.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

insert into public.events (id, organizer_id, title, slug, status) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Privacy Event A', 'privacy-event-a', 'published'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Privacy Event B', 'privacy-event-b', 'published');

insert into public.registrations (
  id, event_id, organizer_id, participant_name, participant_email, payment_status, registration_status
) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Participant A', 'participant-a@example.test', 'under_review', 'received'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Participant B', 'participant-b@example.test', 'under_review', 'received');

insert into public.payment_evidence (id, registration_id, organizer_id, private_object_path, review_status) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/proof.png', 'pending'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000002/proof.png', 'pending');

-- Organizer B is deliberately granted delegated access to Organizer A's event.
-- The grant must not extend to participant records, evidence metadata, or screenshots.
insert into public.organizer_event_access (user_id, event_id, access_level, granted_by) values
  ('10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'editor', '10000000-0000-4000-8000-000000000003');

insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('payment-evidence', '20000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/proof.png', '10000000-0000-4000-8000-000000000001', '{"mimetype":"image/png","size":128}'),
  ('payment-evidence', '20000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000002/proof.png', '10000000-0000-4000-8000-000000000002', '{"mimetype":"image/png","size":128}');

-- Organizer A: can read only its own registration, evidence row, and Storage object.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.registrations), 1, 'Organizer A sees only its own participant registration');
select is((select count(*)::integer from public.payment_evidence), 1, 'Organizer A sees only its own payment-evidence metadata');
select is((select count(*)::integer from storage.objects where bucket_id = 'payment-evidence'), 1, 'Organizer A sees only its own private screenshot object');

-- Organizer B has a valid delegated event grant, but that grant must not expose A's data.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is(private.can_access_event('30000000-0000-4000-8000-000000000001'::uuid), true, 'Delegated event access is present for the test');
select is((select count(*)::integer from public.registrations where organizer_id = '20000000-0000-4000-8000-000000000001'), 0, 'Delegated organizer cannot read A participant records');
select is((select count(*)::integer from public.payment_evidence where organizer_id = '20000000-0000-4000-8000-000000000001'), 0, 'Delegated organizer cannot read A payment-evidence metadata');
select is((select count(*)::integer from storage.objects where bucket_id = 'payment-evidence' and name like '20000000-0000-4000-8000-000000000001/%'), 0, 'Delegated organizer cannot read A private screenshot objects');
select is((select count(*)::integer from public.registrations), 1, 'Organizer B can still read its own participant registration');
select throws_ok(
  $$select public.review_registration_payment('40000000-0000-4000-8000-000000000001'::uuid, 'approved', 'delegated attempt')$$,
  '42501', null,
  'Delegated organizer cannot review A payment'
);

-- Platform owner must not see participant or evidence data and cannot review payments.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.registrations), 0, 'Platform owner cannot read participant registrations');
select is((select count(*)::integer from public.payment_evidence), 0, 'Platform owner cannot read payment-evidence metadata');
select is((select count(*)::integer from storage.objects where bucket_id = 'payment-evidence'), 0, 'Platform owner cannot read private screenshot objects');
select throws_ok(
  $$select public.review_registration_payment('40000000-0000-4000-8000-000000000001'::uuid, 'approved', 'owner attempt')$$,
  '42501', 'Platform owner accounts cannot review participant payments',
  'Platform owner cannot review participant payments'
);

-- Anonymous visitors must not receive direct table grants or private screenshot access.
reset role;
select ok(
  not has_table_privilege('anon', 'public.registrations', 'SELECT'),
  'Anonymous visitors have no direct SELECT grant on participant registrations'
);
select ok(
  not has_table_privilege('anon', 'public.payment_evidence', 'SELECT'),
  'Anonymous visitors have no direct SELECT grant on payment-evidence metadata'
);
set local role anon;
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'payment-evidence'),
  0,
  'Anonymous visitors cannot list or read private payment screenshot objects'
);

-- Only the owning approved organizer may review payment through the audited RPC.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select ok(
  not has_column_privilege('authenticated', 'public.registrations', 'payment_status', 'UPDATE'),
  'Authenticated clients have no direct payment-status update privilege'
);
select throws_ok(
  $stmt$update public.registrations set payment_status = 'rejected' where id = '40000000-0000-4000-8000-000000000001'::uuid$stmt$,
  '42501', null,
  'Direct payment status updates are denied'
);
select lives_ok(
  $$select public.review_registration_payment('40000000-0000-4000-8000-000000000001'::uuid, 'approved', 'local privacy integration test')$$,
  'Owning approved organizer can review its own payment'
);
select is((select payment_status from public.registrations where id = '40000000-0000-4000-8000-000000000001'), 'approved', 'Owning organizer payment review updates registration status');
select is((select review_status from public.payment_evidence where id = '50000000-0000-4000-8000-000000000001'), 'approved', 'Owning organizer payment review updates evidence status');

reset role;
select is((
  select count(*)::integer
  from public.audit_logs
  where actor_user_id = '10000000-0000-4000-8000-000000000001'
    and organizer_id = '20000000-0000-4000-8000-000000000001'
    and target_type = 'registration_payment_review'
    and target_id is null
    and action = 'registration_payment_approved'
    and not (metadata ? 'confirmation_reference')
), 1, 'Owner audit log records payment review without participant identifiers');


-- The privileged account-removal RPC must never be callable by browser roles.
reset role;
select ok(
  not has_function_privilege('anon', 'public.prepare_account_deletion(uuid)', 'EXECUTE'),
  'Anonymous visitors cannot execute account deletion preparation'
);
select ok(
  not has_function_privilege('authenticated', 'public.prepare_account_deletion(uuid)', 'EXECUTE'),
  'Authenticated users cannot execute privileged account deletion preparation'
);
select ok(
  has_function_privilege('service_role', 'public.prepare_account_deletion(uuid)', 'EXECUTE'),
  'Service role can execute account deletion preparation'
);

select * from finish();
rollback;
