# Company-001 — eSports Template 001

The first reusable template is a premium eSports tournament registration page with an organiser workspace preview.

## Current state

- Responsive eSports tournament template and organiser workspace.
- Supabase email/password sign-up and sign-in, plus organiser applications awaiting owner approval.
- Published event routes use `/<organizer-slug>/<event-slug>` (on GitHub Pages, prefix `/Company-001/`). Public details load from Supabase.
- Live registration endpoint validates published events, rate-limits requests, writes registrations server-side, and stores paid-event screenshots in private Storage. Organisers must independently verify transfers; a screenshot is not proof of payment.
- Owner workspace now includes organiser application review and an event publication review queue. Owner decisions are checked inside Supabase functions.
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

## First launch checklist

1. Apply and verify the database migration.
2. Configure Supabase Auth redirect URLs for local and deployed origins.
3. Create a private bucket for payment evidence with strict storage policies.
4. Add a server-side registration endpoint with validation, abuse/rate limits and idempotency.
5. Bootstrap the first platform owner securely; do not grant owner access through the public client.
6. Create an approved organiser, create a test event draft, submit it for review, and approve publication.
7. Finish private screenshot viewing with short-lived signed URLs, and test cross-organiser access denial and rate limits.
8. Finish the consultation, quote approval, and custom-project payment workflow.
9. When ready to deploy, restore the GitHub Pages deployment steps, enable **Settings → Pages → Build and deployment → Source: GitHub Actions**, and verify the complete flow on mobile before sharing it publicly.

Never treat a payment screenshot as proof that a transfer was received. The organiser must verify receipt independently.
