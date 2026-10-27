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
- Custom consultation booking, proposals/quotes, verified custom-project payment flow, custom form builder, and full production QA are not implemented yet.
- Deployment is intentionally paused. GitHub Actions currently validates the Vite build, smoke-tests the consultation endpoint, and stores a temporary build artifact; it does not publish a public website. A green build alone is not proof that the latest code is live at the public URL.

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
4. Reconcile the full existing Supabase migration history with the repository so a fresh environment can be reproduced safely; the live database has more historical migrations than are currently mirrored in this folder.
5. Complete and verify the production build. GitHub Actions is configured to build and smoke-test, but a successful run for the latest changes has not been confirmed here.
6. Decide and configure the actual hosting deployment. Cloudflare Pages deployment is intentionally paused; the current GitHub Actions workflow only stores a temporary build artifact.
7. Implement the remaining consultation/quote approval and custom-project payment workflow if it is still in scope.
8. After release configuration, verify the complete organiser and participant flow on mobile before sharing the live URL.

Never treat a payment screenshot as proof that a transfer was received. The organiser must verify receipt independently.
