# Company-001 application architecture

## Purpose

Company-001 is a multi-organiser event website platform. This document defines boundaries that keep public pages, authentication, organiser tools, the editor, owner tools, and backend security from becoming one tightly coupled application.

This is the target architecture. The current repository is still a compact React/Vite application with a large app shell, large workspace components, and broad CSS files. Do not assume the target folders already exist.

## Product areas and ownership

| Area | Owns | Must not own |
|---|---|---|
| Public site | Landing page, template gallery, published event pages | Authenticated workspace state |
| Authentication and access | Session lifecycle, role resolution, route guards, sign-in callbacks | Dashboard presentation or business data queries |
| Organiser workspace | Organiser profile, events, registrations, analytics, settings | Platform-wide owner controls |
| Website editor | Draft document state, canvas, layers, properties, preview, undo/redo | Auth callback routing or direct privileged database access |
| King Control Room | Owner-only organiser moderation, event review, audit and platform settings | Organiser participant-data browsing |
| Backend integration | Typed data access, Edge Function calls, error mapping | UI component rendering |
| Design system | Tokens, shared controls, layout primitives, responsive rules | Product-specific data fetching |

Participant registrations and private payment evidence remain visible only to the owning organiser under the existing database policies. The architecture must not add an owner bypass or weaken RLS. Platform administration should use aggregate/operational data only where explicitly authorised.

## Target source layout

Adopt this incrementally. Move one feature at a time; do not perform a high-risk all-at-once rewrite.

```text
src/
  app/
    App.jsx
    providers/
    router/
    guards/
    config/
  features/
    public-site/
      pages/
      components/
    auth/
      pages/
      services/
      hooks/
    organizer/
      pages/
      components/
      services/
    editor/
      pages/
      components/
      model/
      services/
    king/
      pages/
      components/
      services/
    registrations/
      components/
      services/
  shared/
    components/
    hooks/
    utils/
    errors/
  services/
    supabase/
      client.js
      auth.js
      repositories/
      functions/
  styles/
    tokens.css
    reset.css
    global.css
    components/
  test/
    unit/
    integration/
```

Supabase migrations, Edge Functions, SQL tests, and deployment configuration remain outside the frontend feature folders.

## Non-negotiable boundaries

1. **One route decision point.** Route selection and guards live in the app router. Feature components do not decide whether an account is an owner or organiser.
2. **One auth/session service.** Components subscribe to a shared auth state; they do not independently create auth listeners or race to redirect.
3. **Role resolution is explicit and fail-closed.** Loading, signed-out, organiser, owner, suspended, and unknown states are distinct. A failed role/workspace lookup must not silently grant organiser access.
4. **One Supabase client.** The client is created once in the services layer and imported; feature components do not instantiate separate clients.
5. **Feature-owned data access.** UI components call feature services/repositories. Queries, error handling, pagination, and ownership filters are not duplicated across screens.
6. **Database security is authoritative.** Frontend route guards improve UX but never replace RLS, storage policies, RPC authorization, or Edge Function validation.
7. **CSS is scoped.** Use design tokens and feature/component namespaces. Avoid global selectors that restyle unrelated dashboards. Avoid import-order tricks as a theme system.
8. **Editor state is isolated.** Draft document state, selection, undo/redo, persistence, and preview are separate from dashboard navigation and auth state.
9. **Responsive behavior is part of each feature.** Every screen must define mobile and desktop behavior, touch targets, overflow handling, and reduced-motion behavior.
10. **Errors are visible and recoverable.** Loading, empty, success, validation, permission, network, and retry states are designed deliberately.

## Design system

Use central CSS variables for semantic tokens, not scattered one-off colours:

- surfaces: page, panel, elevated, overlay
- text: primary, secondary, muted, inverse
- brand: accent, accent-hover, accent-soft
- status: success, warning, danger, info
- borders, focus ring, shadows, radii, spacing, typography, motion

The black / electric-yellow identity is a product theme, not permission to hard-code colours throughout feature CSS. Components should consume semantic tokens. Maintain readable contrast and visible keyboard focus.

## Data and privacy boundaries

- Every organiser-owned query must be scoped to the authenticated organiser/workspace.
- Registration and payment evidence reads must remain protected by RLS and private Storage policies.
- Private evidence access must continue through the authorised server function and short-lived signed URLs.
- Never put service-role keys in browser code or VITE_ variables.
- Owner tools must not gain access to participant submissions merely for convenience or analytics.
- Any migration or Edge Function change requires a security impact note and privacy tests for organiser A, organiser B, and owner roles.

## Incremental migration order

1. Stabilise release workflow and record the current behavior as smoke tests.
2. Extract the shared Supabase client and auth/session state without changing routes.
3. Extract route definitions and explicit role guards; test owner vs organiser routing.
4. Extract shared design tokens and scope CSS without changing screen behavior.
5. Move public pages, organiser workspace, King tools, and editor into feature folders one at a time.
6. Move repeated queries into feature repositories and add typed response contracts.
7. Split the editor model from its visual controls and add deterministic undo/redo and persistence tests.
8. Remove legacy components only after route-level tests prove no active path uses them.

Each step is a small pull request with before/after behavior tests. No step should combine a visual redesign, auth rewrite, and database migration.

## Current known structural debt

- `src/main.jsx` currently combines app state, session resolution, routing decisions, public event loading, and UI.
- `src/OrganizerWorkspace.jsx` is a very large feature component.
- `src/OwnerPanel.jsx` contains a substantial owner interface.
- `src/styles.css` and `src/workspace.css` are large shared stylesheets.
- There are only a small number of release-invariant checks and no clear frontend unit/component test layer in the current package scripts.

Treat this list as a refactoring backlog, not as a reason to rewrite everything at once.
