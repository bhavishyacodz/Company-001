# Company-001 — eSports Template 001

The first reusable template is a premium eSports tournament registration page with an organiser workspace preview.

## Current state

- Responsive eSports tournament template and organiser workspace.
- Supabase email/password sign-up and sign-in, plus organiser applications awaiting owner approval.
- Published event routes use `/<organizer-slug>/<event-slug>` (on GitHub Pages, prefix `/Company-001/`). Public details load from Supabase.
- Live registration endpoint validates published events, rate-limits requests, writes registrations server-side, and stores paid-event screenshots in private Storage. Organisers must independently verify transfers; a screenshot is not proof of payment.
- The root page and organiser dashboard remain preview/sample-data views. The owner review workspace, organiser event creation/editing, live registration review UI, custom quote/payment flow, and production launch checks are still outstanding.

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

## First launch checklist

1. Apply and verify the database migration.
2. Configure Supabase Auth redirect URLs for local and deployed origins.
3. Create a private bucket for payment evidence with strict storage policies.
4. Add a server-side registration endpoint with validation, abuse/rate limits and idempotency.
5. Build the owner approval workspace and organiser event CRUD; create an approved organiser and publish a test event.
6. Connect authenticated registration review, private screenshot viewing and payment-status updates; test cross-organiser access denial and rate limits.
7. In GitHub, enable **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow currently builds successfully, but GitHub's integration cannot enable Pages for this repository automatically.
8. Verify the deployment URL and test the complete flow on mobile before sharing it publicly.

Never treat a payment screenshot as proof that a transfer was received. The organiser must verify receipt independently.
