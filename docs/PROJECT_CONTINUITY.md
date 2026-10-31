# Company-001 project continuity

Last verified: 2026-10-31 (UTC; PR #83 auth-routing work in progress)
Repository: https://github.com/bhavishyacodz/Company-001
Production host: Cloudflare Pages (not Cloudflare Workers)
Production URL: https://company-001.pages.dev/
Supabase project ref: zkzgkovwktljfuuuhivk

## Purpose of this file

This is the canonical handover for future ChatGPT sessions and contributors. Read it before making changes. Update it at the end of each substantial work session with verified commits, PRs, workflow results, deployment URLs, decisions, and the exact next action. Never infer completion from a plan or an old chat.

## Product and non-negotiable constraints

Company-001 is a multi-organiser event website/template platform. Organisers can create and publish event pages, collect registrations, and manage their own participant records and payment evidence.

- Continue the existing repository. Never restart or rebuild from scratch.
- Free-tier-first; assume no infrastructure budget.
- Primary development device is Android; designs must be mobile-first and desktop-compatible.
- Keep King Login separate from Organiser Login.
- Participant registration data and private payment evidence must be accessible only to the organiser that owns the relevant event. The owner/platform admin and other organisers must not gain ordinary access.
- Never weaken RLS, Storage policies, Edge Function authorization, or expose service-role credentials in browser code.
- Frontend guards are UX only; database RLS and server-side authorization are authoritative.
- Do not change production data, run production migrations, merge PRs, or claim production deployment without verifying the exact operation and its result.
- Do not promise zero bugs or five-nines uptime. Build strong prevention, detection, recovery, and regression coverage.
- Keep auth/routing, database/security, and visual redesign changes separate unless a reviewed dependency requires otherwise.
- When the user says "Continue", continue from this recorded checkpoint without repeatedly asking whether to proceed.

## Current stack

- React + Vite frontend.
- Supabase Auth, PostgreSQL, Storage, Edge Functions.
- Cloudflare Pages hosting.
- GitHub Actions and pull-request previews.
- Do not migrate to Next.js, Workers, Kubernetes, Redis, Kafka, Rust, or Go without a measured requirement and a separate approved plan.

## Current architecture decisions

Adopt incrementally:
- Feature-driven modular monolith for the existing React/Vite app.
- Thin app/router layer; feature modules own UI and business behavior.
- One shared Supabase browser client.
- Explicit fail-closed auth states: loading, signed out, organiser, owner, unknown, suspended.
- Protected dashboards mount only after verified role and workspace checks.
- Separate King/owner and organiser access paths.
- Keep relational tables for ownership, registrations, permissions, and transactional data. Use JSONB only where flexible document/config data is appropriate.
- For a future visual website builder, use validated/versioned JSON document structures, draft/published separation, and backward-compatible component schemas. Do not introduce this as a breaking migration before the existing editor is stable.
- Introduce caching, queues, read replicas, cells, multi-region, and custom backend runtimes only when traffic and measured bottlenecks justify them.

## Verified repository checkpoint

Production/main base observed during the 2026-10-31 review:
- main commit: b99bf5fe98ffbdb9b4ce7abec122ebd860450cb1
- main still contains the legacy app shell in src/main.jsx.
- Known routing defects remain on main: missing profile role defaults to organiser; organiser workspace render condition does not explicitly require verified organiser role; signed-out workspace state can fall through to legacy dashboard markup; auth listener does not reliably reconcile the active route.
- These are documented in docs/ROUTING_AUDIT.md on PR #81 and must be fixed in a separate routing PR after PR #82 is integrated.

### PR #81 — Architecture foundation
- URL: https://github.com/bhavishyacodz/Company-001/pull/81
- Branch: chore/architecture-baseline
- Head: 773f898c81a7fa21e2d2a637cbd9cfb14b73e151 at last verification
- State: open, draft, not merged.
- Adds architecture, development workflow, routing audit, and PR template documentation only. No runtime/database changes.
- This file is being added to this branch as the durable handover.

### PR #82 — Shared Supabase client
- URL: https://github.com/bhavishyacodz/Company-001/pull/82
- Branch: refactor/shared-supabase-client
- Head: c978999878e041094458345b345709957bb85431 at last verification
- State: open, draft, not merged.
- Centralises the browser Supabase client in src/services/supabase/client.js and updates six frontend modules.
- No database schema, RLS, Storage, Edge Function, account, event, registration, or participant data changes.
- Local privacy integration workflow 41191412955: completed successfully. Job 124508795577 passed, including local Supabase stack startup, repository migration replay, and two-organiser privacy integration tests.
- Build workflow 41191413035: completed successfully. Job 124508795968 passed dependency audit, release invariants, Vite build, consultation endpoint smoke test, and Pages artifact preparation.
- Cloudflare Pages check for exact head commit: successful. Preview: https://0b32075c.company-001.pages.dev
- A separate Cloudflare check named "Workers Builds: company-001" failed for the same commit and points to a Workers service build. The actual Cloudflare Pages preview succeeded. Do not describe this project as Workers. Before merge, establish whether the Workers check is required or is a stale/misconfigured integration; do not silently ignore it if branch protection requires it.
- PR #82 remains draft and must not be merged until required checks and the Cloudflare check discrepancy are reconciled.

### Older open stacked PR chain — do not merge blindly
- PR #74 security/retry-safe-account-deletion: open, non-draft, based on main.
- PR #75 organizer-only Google sign-in: open, non-draft, based on PR #74 branch; latest metadata reported mergeable=false.
- PR #76 organizer profile tab: open, non-draft, based on PR #75 branch.
- PR #77 signature 3D organizer dashboard: open, draft, based on PR #74 branch.
- PR #78 combined Google login + yellow 3D dashboard: open, draft, based on PR #74 branch.
- PR #79 full-site black/gold UX refresh: open, draft, based on PR #78 branch.
- PR #80 organizer plans/storage usage: open, draft, based on PR #79 branch.
- PR #81 and #82 are separate documentation/client-refactor PRs based on main.
- Reconcile dependencies, file overlap, database migrations, CI, and exact previews before merging or retargeting any stacked PR.

## Active post-login dashboard issue and fix

The live `main` branch still points to the legacy application shell, so the newer yellow/gold 3D organiser dashboard is not yet in production. The intended dashboard styling is present in the open PR #78/#79 stack (including `dashboard-yellow.css` and `experience-redesign.css`). This explains why production can still show the older workspace even when a newer dashboard design exists in GitHub preview branches.

### PR #83 — Post-login dashboard routing fix
- URL: https://github.com/bhavishyacodz/Company-001/pull/83
- Branch: `fix/post-login-dashboard-routing`
- Base: `feat/full-site-black-gold-ux-refresh` (PR #79)
- Latest verified head at this checkpoint: `f57ee7f7fb0852a5ce85638d605ab2f83f017891`
- State: open, draft, not merged; stacked on PR #79 and therefore not independently deployable to production.
- Fixes auth-state routing after login/session refresh; missing/failed profile-role lookups fail closed; organiser workspace is checked before rendering; last workspace tab is restored; stale async auth lookups cannot overwrite a newer session; King Control Room remains owner-only.
- Root cause found during this session: the main `view === "account"` route passed a shortcut callback that marked the organiser workspace ready without verifying it; the other account route depended on parent `signedInUser` state that could still be stale immediately after password login. This combination could bounce users back to the account page or mount the wrong dashboard state.
- Fix now routes both account entry points through one verified workspace handoff, passes the actual authenticated user from login/onboarding, waits for verification before clearing the login busy state, and rechecks both the profile role and organiser workspace.
- The shared Supabase client refactor from PR #82 has now been incorporated into PR #83's stack: the app shell, organiser workspace, company home, organiser access panel, owner panel, audit log, and event review all use `src/services/supabase/client.js`. Release invariants enforce exactly one `createClient()` factory in `src/`.
- Owner routing now checks Supabase MFA assurance and only opens the owner dashboard at AAL2. Template selection routes owners through King Login rather than directly opening the owner dashboard.
- Keeps the yellow/gold dashboard UI supplied by PR #78/#79; it does not redesign the dashboard in this PR.
- Adds `scripts/check-auth-routing.mjs` to the release test gate.
- Latest GitHub Actions run for this head: `41193197868`. Release invariants, frontend build, bounded-body/account-deletion tests, and Edge Function type checks passed. Isolated local Supabase startup/migration/privacy integration was still running at last check.
- Cloudflare Pages preview for exact latest head `f57ee7f`: successful. Preview URL: https://d0757b54.company-001.pages.dev ; branch preview: https://fix-post-login-dashboard-rou.company-001.pages.dev. This is a preview only, not production.
- The separate `Workers Builds: company-001` check is still in progress for latest head `f57ee7f`; earlier PR previews showed it failing against a distinct Workers service while Pages succeeded independently. Cloudflare docs describe Pages and Workers as separate Git integrations/checks. Branch-protection status could not be read with the connected GitHub permissions, so do not assume the Workers check is non-blocking.
- PR #82 remains open/draft on its original main-based branch. Its shared-client changes now overlap with PR #83; do not merge #82 separately after the PR #83 stack has integrated those same changes. Keep #82 open until the stacked UI/auth release path is resolved, then close as superseded or reconcile explicitly.
- No production code, production database, RLS/Storage policy, or participant data has been changed by PR #83.
- No production code, production database, RLS/Storage policy, or participant data was changed.

## Immediate work queue (strict order)

1. Finish and verify current PR #83 Actions run `41215213832`, including local Supabase migration replay and two-organiser privacy tests. Confirm the Pages preview for exact head `f57ee7f` remains successful.
2. Run a manual login regression on the exact preview: organiser password login, Google organiser login, return to dashboard, refresh, reopen the dashboard, and verify King Login still requires AAL2. Do not enter real participant or payment data on the preview.
3. Investigate the separate Workers Builds check and determine whether it is required by branch protection. Branch-protection reads return 403 to the connected integration; do not assume the check is non-blocking.
4. Reconcile the PR #74 → #78 → #79 → #83 stack and review every diff before merging. PR #83 now includes PR #82's shared-client refactor; do not merge duplicate client changes. Keep PR #82 open until the stack is integrated, then close it as superseded or explicitly reconcile it.
5. Reconcile PR #81 documentation with the release branch and merge it only after reviewing its latest head and checks.
6. After the auth/UI stack is safely integrated, audit production RLS, Storage policies, Edge Function checks, and participant evidence access. Do not change production policies without migration review and explicit tests.
7. Extract feature modules incrementally, without combining unrelated visual redesign or schema changes.
8. Improve the dashboard/editor after auth and privacy are stable; maintain mobile-first and desktop-compatible layouts.
9. Add versioned website document AST and draft/publish separation only when the editor model is ready.
10. Add performance/scaling features only when measurements justify them, and verify the exact Cloudflare Pages production deployment before announcing a release.

## Release verification standard

For each PR, record:
- PR number and branch.
- Exact head commit SHA.
- GitHub Actions workflow IDs and final conclusions.
- Cloudflare Pages preview URL and exact deployed commit.
- Any failed or irrelevant integration checks and why they are/aren't blocking.
- Security/privacy impact and tests.
- Merge SHA only after a verified merge.
- Production deployment ID/commit and smoke-test result only after verified production release.

A successful local test is not proof of production RLS. A successful build is not proof of a successful Pages deployment. A preview deployment is not a production deployment.

## New-chat resume instruction

When opening a new ChatGPT chat, send:
"Continue Company-001 from the latest docs/PROJECT_CONTINUITY.md in https://github.com/bhavishyacodz/Company-001. First read the current repository and PR/workflow status, then continue from the Immediate work queue. Do not restart, do not ask me to repeat known requirements, and update the continuity file after substantial progress."

The assistant should verify live repository state before acting because this file is a checkpoint, not a substitute for current GitHub status.
