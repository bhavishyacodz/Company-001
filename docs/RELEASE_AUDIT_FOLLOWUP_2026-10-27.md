# Release audit follow-up — 2026-10-27

## Verified observations

- The GitHub Actions workflow builds with Node.js 20, runs a consultation endpoint smoke test, prepares the SPA fallback, and uploads `dist` as a temporary artifact.
- The workflow does not deploy to Cloudflare Pages. Do not treat a green build as proof that the public URL has been updated.
- `package.json` pins direct dependencies, but the repository does not contain `package-lock.json`. Dependency resolution in CI is therefore not fully reproducible. Do not switch to `npm ci` until a lockfile is generated and reviewed.
- The overlapping SELECT policies on `public.organizer_event_access` were consolidated. The live database now has one SELECT policy and separate owner-only INSERT, UPDATE, and DELETE policies. The performance advisor no longer reports the overlapping-policy warning for this table.
- Two foreign-key indexes for `organizer_event_access` have been created and their migration is present in the repository.
- The live migration ledger records version `20261027161230` with the name `20261027162500_index_organizer_event_access_foreign_keys`, while the repository filename uses `20261027161230_index_organizer_event_access_foreign_keys.sql`. This naming discrepancy is documented; do not rewrite migration history or replay it just to rename it.
- The three previously missing migration files have now been restored from their original GitHub commit diffs: `20261027084200_limit_registration_review_updates.sql`, `20261027085931_atomic_registration_payment_review.sql`, and `20261027091337_guard_payment_review_transitions.sql`. They were restored as source-history files only; they were not replayed against the live database.
- Supabase's security advisor still reports leaked-password protection disabled and warns about three authenticated-callable SECURITY DEFINER review RPCs. The RPCs deny `anon`, require internal owner/event-organiser authorization, and use an empty `search_path`; do not revoke access blindly because the owner dashboard uses these operations.

- A source-level release check was added to CI. The six invariants were independently checked against the current repository files and all six passed; the actual GitHub Actions run and Node.js build still need confirmation.
- A live read-only RLS audit confirmed RLS is enabled on the reviewed public tables. The `profiles` policies only allow self-insert as `organizer`, self-read (or owner-read), and self-update only while the resulting role remains `organizer`. Owner-only organiser creation, publication transitions, and review RPC authorization checks are present. This was a policy-definition review, not a full multi-user end-to-end test.
- The latest live Supabase security advisor still reports leaked-password protection disabled and three authenticated-callable `SECURITY DEFINER` review RPCs. Inspection confirmed those RPCs deny `anon`, use an empty `search_path`, and check the platform owner or appropriate event organiser internally. Keep their authenticated grants only while required by the owner dashboard and continue testing authorization.
- The performance advisor currently reports 12 unused indexes as informational findings. Do not remove them without query/workload evidence.

## Safe next steps

1. Compare the restored migration contents with the live schema and migration ledger before any future migration replay or fresh-project bootstrap.
2. Test RLS with owner, assigned user, unrelated authenticated user, and anonymous sessions in a non-production environment where possible.
3. Generate and review a lockfile using the project's intended Node/npm versions; only then change CI to deterministic installation.
4. Enable leaked-password protection in Supabase Auth settings.
5. Run the workflow and end-to-end checks, then configure hosting deployment separately with appropriate secrets and permissions.

## Release safety

No production deployment is implied by this document. Preserve existing registrations, organiser accounts, payment evidence, and audit history. Never put Supabase service-role or secret keys in browser-exposed environment variables.
