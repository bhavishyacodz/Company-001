# Company-001 — eSports Template 001

The first reusable template is a premium eSports tournament registration page with an organiser workspace preview.

## Current state

- Responsive eSports tournament template and organiser workspace.
- Supabase email/password sign-up and sign-in, plus organiser applications awaiting owner approval.
- Published event routes use `/<organizer-slug>/<event-slug>` (on GitHub Pages, prefix `/Company-001/`). Public details load from Supabase.
- Live registration endpoint validates published events, rate-limits requests, writes registrations server-side, and stores paid-event screenshots in private Storage. Organisers must independently verify transfers; a screenshot is not proof of payment.
- Owner workspace includes organiser application review and an event publication review queue. Owner decisions are checked inside Supabase functions, with database-level guards against direct publication bypasses.
- Organiser approval/suspension status is protected at the database boundary; payment and registration status changes must use the audited payment-review RPC.
- Approved organisers can create/edit event drafts and view real registration records in the organiser workspace. Public publication is restricted to the platform owner.
- Organiser workspace includes searchable event and registration directories, registration/payment status filters, overview metrics, a dedicated payment-review queue, and per-event registration analytics calculated from loaded records.
- Event creation includes selectable templates, branding and custom registration fields, plus a responsive live draft preview. Drafts remain private until the existing platform-owner review approves publication.
- Private payment evidence is accessed through the existing `view-payment-evidence` Supabase function using short-lived signed URLs. Evidence is not treated as proof of transfer.
- Security audit (2026-10-27): RLS is enabled on reviewed public tables. The three owner/review RPCs deny `anon`, require signed-in owner or event-organiser checks as appropriate, and pin `search_path` to an empty value. The Supabase advisor still warns about authenticated execution of SECURITY DEFINER functions; retain these checks and review least-privilege grants as part of release QA.
- Registration table audit: authenticated users have read access subject to RLS; direct UPDATE grants are limited to the payment/registration status columns, and the database trigger requires the audited review RPC to change those statuses.
- Custom consultation booking, proposals/quotes, verified custom-project payment flow, custom form builder, and full production QA are not implemented yet.

## Build and hosting status

- The Build Company-001 GitHub Actions workflow succeeded for commit `af9687a70f6ad2f75391275181b689dc56958ebb`. Its release-invariant checks, Vite build, consultation endpoint smoke tests, SPA fallback preparation, and temporary artifact upload all passed: [workflow run](https://github.com/bhavishyacodz/Company-001/actions/runs/40543037727).
- GitHub Pages' separate pages build and deployment workflow also completed successfully for that commit: [Pages workflow run](https://github.com/bhavishyacodz/Company-001/actions/runs/40543037473). This confirms the GitHub Pages workflow deployment succeeded; it does **not** prove that Cloudflare Pages at `https://company-001.pages.dev/` is updated or that the full live app has passed end-to-end QA.
- The Vite workflow currently uses `npm install` because `package-lock.json` is not committed. Direct dependencies are pinned in `package.json`, but transitive dependency resolution is not fully reproducible yet. Do not switch to `npm ci` until a lockfile is generated and reviewed.
- Verify which hostname is intended for production and test that hostname directly after any hosting change. Do not assume GitHub Pages and Cloudflare Pages share deployments.

## Run locally

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env
npm run dev
```

The UI works in preview mode without Supabase credentials. Do not add a Supabase service-role or secret key to `.env` values prefixed with `VITE_`; browser variables are public.

## Environment

- `VITE_SUPABASE_URL`: project API URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key only.

## Remaining release checklist

1. Verify Supabase Auth redirect URLs for every intended deployment origin.
2. Enable leaked-password protection in Supabase Auth settings; the latest Supabase security advisor still reports it disabled.
3. Run full end-to-end tests for organiser signup/approval, event draft → owner review → publication, registration submission, private evidence viewing, and cross-organiser access denial.
4. Compare the restored historical migration files with the live schema and migration ledger before any future migration replay or fresh-project bootstrap. Files `20261027084200_limit_registration_review_updates.sql`, `20261027085931_atomic_registration_payment_review.sql`, and `20261027091337_guard_payment_review_transitions.sql` have been restored from original GitHub commit diffs, but were not replayed against the live database.
5. Generate and review a lockfile with the intended Node/npm versions, then update CI to use deterministic dependency installation.
6. Confirm the intended production hostname (Cloudflare Pages or GitHub Pages) and verify that hostname, authentication redirects, and participant/organiser flows on mobile before sharing it.
7. Implement the remaining consultation/quote approval and custom-project payment workflow if it is still in scope.

Never treat a payment screenshot as proof that a transfer was received. The organiser must verify receipt independently.
