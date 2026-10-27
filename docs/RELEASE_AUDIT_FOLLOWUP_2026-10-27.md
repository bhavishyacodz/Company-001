# Release audit follow-up — 2026-10-27

## Latest verified build and deployment workflow

- The latest Company-001 build workflow passed for commit `dd673b4953ee0c139d09d7bdc211a742ec8ae5ae`: [run 40549504977](https://github.com/bhavishyacodz/Company-001/actions/runs/40549504977). Verified steps include locked dependency installation, `npm audit --audit-level=low`, release security invariants, Vite build, consultation endpoint smoke tests (no database writes), SPA fallback preparation, and build artifact upload.
- The GitHub Pages build-and-deployment workflow completed successfully for the same commit: [run 40549504535](https://github.com/bhavishyacodz/Company-001/actions/runs/40549504535). This is evidence that the GitHub Pages workflow succeeded; it does not prove that Cloudflare Pages at `https://company-001.pages.dev/` was updated or that the full production app passed end-to-end testing.
- `package-lock.json` is now present and CI uses `npm ci`. The previous note saying the lockfile was missing is obsolete.
- The latest UI-only change polished organiser event-builder focus states, keyboard focus visibility, custom-field editing feedback, reduced-motion behavior, and sticky draft actions. It does not change database schema or production data.

## Verified database and security observations

- A live read-only audit confirmed RLS is enabled on all 10 reviewed public tables.
- The `profiles` policies restrict self-insert to the `organizer` role and self-update so the resulting role remains `organizer`; owner access is separately controlled.
- Owner-only organiser creation and event-publication transitions are guarded. Event registration access is limited by the event organiser/access grant or platform-owner authorization.
- The overlapping SELECT policies on `public.organizer_event_access` were consolidated. Separate owner-only INSERT, UPDATE, and DELETE policies remain. Two foreign-key indexes for this table have been created.
- The live migration ledger records version `20261027161230` with the name `20261027162500_index_organizer_event_access_foreign_keys`, while the repository filename uses `20261027161230_index_organizer_event_access_foreign_keys.sql`. This discrepancy is documented; do not rewrite migration history or replay the migration just to rename it.
- Three historical migration files were restored from their original GitHub commit diffs: `20261027084200_limit_registration_review_updates.sql`, `20261027085931_atomic_registration_payment_review.sql`, and `20261027091337_guard_payment_review_transitions.sql`. They were restored as source-history files and were not replayed against the live database.
- The live security advisor reports leaked-password protection disabled and three authenticated-callable SECURITY DEFINER review RPCs: `review_event_publication`, `review_organizer_application`, and `review_registration_payment`. Inspection found they deny `anon`, use an empty `search_path`, and enforce internal owner/event-organiser authorization. Do not revoke authenticated grants blindly because the dashboard depends on these operations.
- Release-invariant checks passed in CI. They are source-level regression checks, not a substitute for multi-user authorization testing.
- The performance advisor reported 12 unused indexes as informational findings. Do not remove them without workload evidence.

## Outstanding release checks

1. Verify the intended production hostname and confirm the latest UI is served there. GitHub Pages workflow success does not verify Cloudflare Pages deployment.
2. Test auth redirects and published-event routes on the intended production hostname.
3. Test authorization with owner, assigned organiser, unrelated authenticated user, and anonymous sessions in a safe test environment. Full multi-user end-to-end authorization testing has not been completed.
4. Enable leaked-password protection in Supabase Auth settings; this dashboard setting has not been changed here.
5. Compare restored migration source files against the live schema and migration ledger before any future migration replay or fresh-project bootstrap.
6. Continue premium visual-editor work independently from release checks, and do not claim production release readiness until the outstanding checks are complete.

## Release safety

No production registration, organiser account, payment-evidence object, or audit history was modified during the latest UI work. Preserve existing user data. Never put Supabase service-role or secret keys in browser-exposed environment variables.
