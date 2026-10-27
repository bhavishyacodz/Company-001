# Release audit follow-up — 2026-10-27

## Verified observations

- The Vite build workflow succeeded for commit `af9687a70f6ad2f75391275181b689dc56958ebb`: [run 40543037727](https://github.com/bhavishyacodz/Company-001/actions/runs/40543037727). All listed steps passed: dependency installation, six release-invariant checks, `vite build`, consultation endpoint smoke tests, SPA fallback preparation, and temporary artifact upload.
- GitHub Pages' separate build-and-deployment workflow also succeeded for that commit: [run 40543037473](https://github.com/bhavishyacodz/Company-001/actions/runs/40543037473). This confirms that GitHub Pages deployment workflow completed successfully. It does not prove that Cloudflare Pages at `https://company-001.pages.dev/` was updated, nor does it substitute for end-to-end testing of the app on the intended production hostname.
- `package.json` pins direct dependencies, but the repository does not contain `package-lock.json`. Dependency resolution in CI is therefore not fully reproducible. Do not switch to `npm ci` until a lockfile is generated and reviewed.
- The overlapping SELECT policies on `public.organizer_event_access` were consolidated. The live database now has one SELECT policy and separate owner-only INSERT, UPDATE, and DELETE policies. The performance advisor no longer reports the overlapping-policy warning for this table.
- Two foreign-key indexes for `organizer_event_access` have been created and their migration is present in the repository.
- The live migration ledger records version `20261027161230` with the name `20261027162500_index_organizer_event_access_foreign_keys`, while the repository filename uses `20261027161230_index_organizer_event_access_foreign_keys.sql`. This naming discrepancy is documented; do not rewrite migration history or replay it just to rename it.
- The three previously missing migration files have now been restored from their original GitHub commit diffs: `20261027084200_limit_registration_review_updates.sql`, `20261027085931_atomic_registration_payment_review.sql`, and `20261027091337_guard_payment_review_transitions.sql`. They were restored as source-history files only; they were not replayed against the live database.
- The live security advisor reports leaked-password protection disabled and three authenticated-callable SECURITY DEFINER review RPCs. The RPCs deny `anon`, require internal owner/event-organiser authorization, and use an empty `search_path`; do not revoke access blindly because the owner dashboard uses these operations.
- All six source-level release invariants passed in the recorded CI run. These checks complement, but do not replace, multi-user authorization tests.
- A live read-only RLS audit confirmed RLS is enabled on the reviewed public tables. The `profiles` policies only allow self-insert as `organizer`, self-read (or owner-read), and self-update only while the resulting role remains `organizer`. Owner-only organiser creation, publication transitions, and review RPC authorization checks are present. This was a policy-definition review, not a full multi-user end-to-end test.
- Inspection confirmed the three review RPCs deny `anon`, use an empty `search_path`, and check the platform owner or appropriate event organiser internally. Keep their authenticated grants only while required by the owner dashboard and continue testing authorization.
- The performance advisor currently reports 12 unused indexes as informational findings. Do not remove them without query/workload evidence.

## Safe next steps

1. Confirm the intended production hostname (Cloudflare Pages or GitHub Pages) and test that exact URL, including auth redirects and published event routes.
2. Test RLS with owner, assigned organiser, unrelated authenticated user, and anonymous sessions in a non-production environment where possible.
3. Generate and review a lockfile using the project's intended Node/npm versions; only then change CI to deterministic installation.
4. Enable leaked-password protection in Supabase Auth settings.
5. Compare the restored migration contents with the live schema and migration ledger before any future migration replay or fresh-project bootstrap.
6. Only after hostname and auth tests pass, continue premium visual-editor development and plan any production release changes separately.

## Release safety

GitHub Pages deployment workflow success is confirmed; Cloudflare Pages deployment and complete production end-to-end QA are not confirmed here. Preserve existing registrations, organiser accounts, payment evidence, and audit history. Never put Supabase service-role or secret keys in browser-exposed environment variables.
