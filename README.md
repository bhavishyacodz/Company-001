# Company-001 — eSports Template 001

The first reusable template is a premium eSports tournament registration page with an organiser workspace preview.

## Current state

- Responsive eSports tournament template and organiser workspace.
- Supabase email/password sign-up and sign-in, with organiser applications and owner-controlled organiser approval.
- Published event routes use `/<organizer-slug>/<event-slug>` (on GitHub Pages, prefix `/Company-001/`). Public event details load from Supabase.
- Live registration endpoint validates published events, rate-limits requests, writes registrations server-side, and stores paid-event screenshots in private Storage. Organisers must independently verify transfers; a screenshot is not proof of payment.
- Owner workspace includes organiser application review and an event publication review queue. Owner decisions are checked inside Supabase functions, with database-level guards against direct publication bypasses.
- Organiser approval/suspension status is protected at the database boundary; payment and registration status changes must use the audited payment-review RPC.
- Approved organisers can create/edit event drafts and view registration records in the organiser workspace. Public publication is restricted to the platform owner.
- Organiser workspace includes searchable event and registration directories, registration/payment status filters, overview metrics, a dedicated payment-review queue, and per-event registration analytics calculated from loaded records.
- Event creation includes selectable templates, branding and custom registration fields, plus a responsive live draft preview. Drafts remain private until the existing platform-owner review approves publication.
- Private payment evidence is accessed through the existing `view-payment-evidence` Supabase function using short-lived signed URLs. Evidence is not treated as proof of transfer.
- Homepage project enquiry form and private owner consultation inbox are implemented. The `request-consultation` Edge Function validates payloads, restricts origins, applies rate limiting, and performs server-side insertion; CI smoke tests exercise trusted/untrusted origins and invalid payloads without creating enquiry rows.
- Security advisor currently reports three authenticated-callable SECURITY DEFINER review RPCs and leaked-password protection disabled. The review RPCs perform internal authorization checks; retain those checks and review least-privilege grants. Enable leaked-password protection in Supabase Auth settings.
- Registration table access is constrained by RLS; direct status updates are guarded so payment/registration review changes use the audited RPC.

## Build and hosting status

- Latest verified `main` commit: `572b17ce8282232dbd809281c335fed247167605` (`style: refine draft link copy controls`).
- The Build Company-001 workflow passed for that commit, including locked dependency installation, dependency audit, release-invariant checks, Vite build, consultation endpoint smoke tests, SPA fallback preparation, and artifact upload: [workflow run #210](https://github.com/bhavishyacodz/Company-001/actions/runs/40552363331).
- GitHub Pages' separate pages build and deployment workflow completed successfully for that commit: [Pages workflow run #113](https://github.com/bhavishyacodz/Company-001/actions/runs/40552363862). This confirms the GitHub Pages deployment workflow succeeded; it does **not** prove that Cloudflare Pages at `https://company-001.pages.dev/` is updated or that the full live app has passed end-to-end QA.
- `package-lock.json` is committed. CI uses `npm ci` for deterministic dependency installation and runs `npm audit --audit-level=low`.
- The Supabase project `zkzgkovwktljfuuuhivk` reported `ACTIVE_HEALTHY` during the latest check. Its migration ledger includes the historical payment-review migrations, but verify the live schema against repository migrations before any future migration replay or fresh-project bootstrap.
- GitHub Pages and Cloudflare Pages are separate deployment paths. Confirm which hostname is intended for production and test that hostname directly after hosting changes.

## Run locally

Requires Node.js 20 or later.

```bash
npm ci
cp .env.example .env
npm run dev
```

The UI works in preview mode without Supabase credentials. Do not add a Supabase service-role or secret key to `.env` values prefixed with `VITE_`; browser variables are public.

## Environment

- `VITE_SUPABASE_URL`: project API URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key only.

## Remaining release checklist

1. Verify Supabase Auth redirect URLs for every intended deployment origin.
2. Enable leaked-password protection in Supabase Auth settings; the latest Supabase security advisor reports it disabled.
3. Run full end-to-end tests for organiser signup and owner approval, event draft → owner review → publication, registration submission, private evidence viewing, consultation enquiry and owner-inbox status updates, and cross-organiser access denial. These require a real browser session and appropriate owner/organiser accounts.
4. Compare the live schema with the repository migrations before any migration replay or fresh-project bootstrap. The live migration ledger includes the historical payment-review migration versions; this alone does not prove schema equivalence.
5. Confirm the intended production hostname (Cloudflare Pages or GitHub Pages) and verify that hostname, authentication redirects, and participant/organiser flows on mobile before sharing it.
6. Complete the remaining consultation/quote approval and custom-project payment workflow if it is still in scope.

Never treat a payment screenshot as proof that a transfer was received. The organiser must verify receipt independently.
