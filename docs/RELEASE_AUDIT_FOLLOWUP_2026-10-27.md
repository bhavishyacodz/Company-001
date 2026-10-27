# Release audit follow-up — 2026-10-27

## Verified observations

- The GitHub Actions workflow builds with Node.js 20, runs a consultation endpoint smoke test, prepares the SPA fallback, and uploads `dist` as a temporary artifact.
- The workflow does not deploy to Cloudflare Pages. Do not treat the public URL as updated by a green build.
- `package.json` pins direct dependencies, but the repository does not contain `package-lock.json`. Dependency resolution in CI is therefore not fully reproducible. Do not switch to `npm ci` until a lockfile is generated and reviewed.
- Supabase's performance advisor reports overlapping SELECT policies on `public.organizer_event_access`: `organizer_event_access_owner_manage` and `organizer_event_access_user_read`.
- Two foreign-key indexes for `organizer_event_access` have been created and their migration is present in the repository.
- Three migration versions exist in Supabase without matching repository files: `20261027084200_limit_registration_review_updates`, `20261027085931_atomic_registration_payment_review`, and `20261027091337_guard_payment_review_transitions`.

## Safe next steps

1. Recover the original SQL for the three missing migration versions from source control or trusted backups. Do not reconstruct historical SQL from names.
2. Before consolidating RLS policies, capture the exact live policies and test owner, assigned-user, unrelated-user, and anonymous access expectations.
3. Generate and review a lockfile using the project's intended Node/npm versions; only then change CI to deterministic installation.
4. Enable leaked-password protection in Supabase Auth settings.
5. Run the workflow and end-to-end checks, then configure hosting deployment separately with appropriate secrets and permissions.

## Release safety

No production deployment is implied by this document. Preserve existing registrations, organiser accounts, payment evidence, and audit history. Never put Supabase service-role or secret keys in browser-exposed environment variables.
