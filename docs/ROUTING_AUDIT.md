# Company-001 routing and authentication audit

Audit target: `main` at the architecture-baseline review on 2026-10-31.

## Current route model

The app shell in `src/main.jsx` uses a local `view` state rather than a dedicated router.

Observed view names include:

- Public: `site`, `templates`
- Account: `account`
- Owner: `king-login`, `owner`
- Organiser: `organizer`, `registrations`, `customize`

The current app shell also owns the Supabase session lookup, profile-role lookup, organiser workspace lookup, OAuth callback handling, and the final component-selection logic.

## Current session routing behavior

1. The app reads the Supabase session with `supabase.auth.getSession()`.
2. It reads `profiles.platform_role`; if the profile row is absent, the current code defaults the role to `organizer`.
3. An owner is routed to `owner`.
4. An organiser is routed to the organiser workspace only when an organiser row exists; otherwise the account view is shown.
5. Unknown roles are sent to the account view.
6. The auth-state listener refreshes the signed-in user and role, but does not itself reconcile the current view.

## Confirmed route-guard gaps

The render logic currently has these conditions:

- It shows a restoring screen while auth is not ready and the view is one of the organiser workspace views.
- It mounts `OrganizerWorkspace` when a signed-in user exists and the view is an organiser workspace view.
- It does not also require `platformRole === "organizer"` in that render condition.
- If the view is an organiser workspace view after auth is ready but there is no signed-in user, rendering falls through to the older demo dashboard markup inside `main.jsx`.

This means the old demo dashboard remains a reachable fallback for workspace view state, and the frontend route condition is not as strict as the product's owner/organiser separation requires. Database RLS remains the security boundary, but the UI route should fail closed as well.

The profile-role lookup also defaults a missing profile to `organizer`. This is not a safe role-resolution default for routing; missing or failed role data should be treated as unknown until verified.

## Required target behavior

| Auth state | Organiser workspace route | King route |
|---|---|---|
| Loading | Show restoring state | Show restoring state |
| Signed out | Redirect/show organiser login | Show King Login only |
| Verified organiser with active workspace | Allow | Do not allow owner panel |
| Verified owner | Do not allow organiser workspace | Allow owner panel |
| Unknown/missing role | Deny workspace and owner routes | Deny |
| Suspended organiser | Deny workspace | Deny |

## Safe fix sequence

1. Centralise the Supabase client (tracked separately in PR #82).
2. Extract one auth/session provider that produces explicit states: loading, signed out, organiser, owner, unknown, and suspended.
3. Put all protected route decisions in one route guard; do not let individual components infer roles.
4. Require an explicitly verified organiser role and active organiser workspace before mounting `OrganizerWorkspace`.
5. Require an explicitly verified owner role before mounting `OwnerPanel`.
6. Replace the legacy demo dashboard fallback with a safe account/login or not-authorised state.
7. Make auth listener updates reconcile route access when the user signs in, signs out, changes role, or is suspended.
8. Add tests for signed-out, organiser, owner, missing profile, failed profile query, missing workspace, suspended account, OAuth callback, refresh, and direct protected-route navigation.

## Scope warning

Do not combine this routing fix with a visual redesign or database migration. Implement it as a separate, small pull request after the shared Supabase client refactor is integrated. Preserve all existing RLS policies and the requirement that participant registrations and private payment evidence are visible only to the owning organiser.
