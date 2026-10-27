# Company-001 — eSports Template 001

The first reusable template is a premium eSports tournament registration page with an organiser workspace preview.

## Current state

- Responsive public tournament landing page and registration-form preview.
- Organiser workspace preview with sample registrations.
- Local template customization preview (event title, organiser name, entry label and accent colour).
- The current UI is explicitly in **preview mode**. Registration submissions and selected files stay in the browser session; they are not sent to a server.
- Supabase schema is maintained under `supabase/migrations/`. Live authentication, registration writes, private screenshot uploads, review actions and payment verification still need secure integration and testing.

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
5. Connect organiser login, approval workflow, event CRUD and private screenshot review.
6. Test RLS, cross-organiser access denial, file access, mobile layouts and duplicate submissions.
7. Configure and verify hosting before sharing a public production link.

Never treat a payment screenshot as proof that a transfer was received. The organiser must verify receipt independently.
