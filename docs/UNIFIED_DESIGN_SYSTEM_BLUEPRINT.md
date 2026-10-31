# Company-001 Unified Design System & Theme Studio Blueprint

## Purpose

Create one maintainable design architecture for every Company-001 surface and make approved visual systems reusable as organizer event themes/templates. The first release is an internal foundation; the King Control Room Design Studio and public organizer theme marketplace are later product surfaces built on the same contracts.

This document is an implementation contract, not a claim that the Design Studio already exists.

## Product principles

1. **One component language:** navigation, buttons, tabs, cards, dialogs, forms, tables, badges, empty states, loading states, alerts, menus, and editor controls use shared components and tokens.
2. **Two separate theme targets:** platform themes style Company-001 itself; event themes style organizer-owned public event websites and registration experiences. They may share tokens and components, but they must not share permissions or publication state.
3. **Preview before publish:** drafts and previews never alter the active production theme.
4. **Data is independent of presentation:** theme changes must not rewrite event records, registrations, payment evidence, auth state, roles, routes, or RLS policies.
5. **Version and rollback:** each published theme points to an immutable version; reverting changes the active version pointer rather than destroying history.
6. **Mobile-first and accessible:** every component has responsive behaviour, keyboard/focus states, readable contrast, and reduced-motion support.
7. **Free-first:** use the existing React/Vite stack and existing hosting/database capabilities before adding paid services.

## Current codebase observations (audit baseline)

- The app entry and auth/router orchestration are in `src/main.jsx`.
- Major surfaces are already split into `CompanyHome.jsx`, `OrganizerWorkspace.jsx`, and `OwnerPanel.jsx`; the King panel also composes smaller review/access components.
- Global styling is currently layered across `styles.css`, `premium-refresh.css`, and `experience-redesign.css`. The organizer workspace additionally imports `workspace.css` and `dashboard-yellow.css`.
- Organizer event template definitions currently live in the `EVENT_TEMPLATES` array inside `OrganizerWorkspace.jsx`.
- Organizer event branding is currently represented by fields such as `primary_color`, `font_family`, logo/background settings, hero alignment/size, and page sections in the editor form.
- The project currently has a release test script (`npm run test:release`) that runs release invariants and auth-routing checks.

These observations mean the work should be an incremental extraction and consolidation. Do not replace the existing UI wholesale or delete current CSS before equivalent coverage and regression tests exist.

## Target architecture

### A. Design tokens

Create semantic tokens, not page-specific colour literals:

- Colour: `--color-canvas`, `--color-surface`, `--color-surface-raised`, `--color-text`, `--color-muted`, `--color-border`, `--color-primary`, `--color-primary-contrast`, `--color-accent`, `--color-success`, `--color-warning`, `--color-danger`, focus ring.
- Typography: font families, display/body roles, scale, weight, line-height, letter spacing.
- Spacing: a consistent scale.
- Shape: control/card/dialog radii.
- Elevation: shadow levels and overlays.
- Motion: durations/easing plus a reduced-motion override.
- Layout: content widths, breakpoints, navigation dimensions and z-index layers.

Components must consume semantic tokens. Theme-specific values belong in theme definitions, not duplicated selector overrides.

### B. Shared components

Build and migrate in small groups:

1. Foundations: Button, IconButton, TextField, Select, Checkbox, Label, Typography, Surface, Stack/Container.
2. Navigation: top bar, sidebar item, tab bar, breadcrumb, mobile navigation.
3. Feedback: Alert, Toast, Badge, EmptyState, Skeleton, Spinner, ConfirmDialog.
4. Data: StatCard, Table, FilterBar, SearchField, Pagination.
5. Product patterns: ProfileHeader, WorkspaceHeader, EventCard, TemplateCard, EditorToolbar, PreviewFrame.

Every component needs documented variants, disabled/loading states, accessible names, keyboard behaviour, and responsive rules. Do not create a new one-off style if an existing shared component can represent it.

### C. Theme contract

Use a validated, versioned theme document. Initial conceptual shape:

```ts
type ThemeTarget = "platform" | "event";

type ThemeDefinition = {
  id: string;
  version: number;
  name: string;
  target: ThemeTarget;
  status: "draft" | "published" | "archived";
  tokens: {
    colors: Record<string, string>;
    typography: Record<string, string | number>;
    spacing: Record<string, string>;
    radii: Record<string, string>;
    shadows: Record<string, string>;
    motion: Record<string, string>;
  };
  componentVariants: Record<string, string>;
  supportedLayouts: string[];
  previewAssets?: string[];
};
```

The final schema must be validated at runtime and restricted to approved token names and safe CSS values. Do not allow arbitrary HTML, JavaScript, external scripts, or unsafe CSS injection in organizer-created themes.

### D. Platform theme flow

King Control Room → Design Studio → Platform Theme Library → Draft → Preview → Responsive/accessibility checks → Publish → Version history / rollback.

Only the platform owner with the required owner assurance level may manage platform themes. Theme management must not grant access to participant data or payment evidence.

### E. Organizer theme/template flow

Public Template Gallery → choose category/template → preview → organizer customizes event content and permitted theme controls → publish event page.

Organizer theme ownership and event content remain scoped to that organizer. The platform owner and other organizers must not gain visibility into participant data through this feature. Theme records must not contain participant data, payment screenshots, secrets, or auth credentials.

A future marketplace may expose approved event themes with categories, screenshots, device previews, version compatibility, and free/premium availability. Do not add paid checkout or billing as part of the foundation.

## Template quality requirements

Improve existing templates before increasing quantity. Every template should have:

- A distinct, intentional visual identity and useful event-specific layout.
- Desktop, tablet, and mobile previews.
- Clear hero, event details, schedule/venue, rules, organiser contact and registration sections where relevant.
- Good typography, hierarchy, contrast, and accessible form labels.
- Custom fields that fit the event category.
- Safe image URL handling and sensible fallbacks.
- Clear registration/payment states without exposing private evidence publicly.
- A content-only editing path that does not require code.

New templates should be added through a centralized, typed template registry rather than another large inline array in the workspace component.

## Migration plan

### Phase 0 — Baseline and safety
- Record screenshots and route coverage for public, account, organizer, editor, King, and live event surfaces.
- Keep the current active visual appearance as the baseline theme.
- Add regression coverage for auth routing, role separation, organizer data isolation, and public event rendering.
- Inventory duplicated selectors, hardcoded values, and existing component variants.

### Phase 1 — Token foundation
- Introduce semantic token files and a typed theme registry.
- Map the current visual appearance to a named baseline theme so this phase does not unexpectedly redesign production.
- Add a safe theme provider/attribute boundary for platform and event scopes.
- Verify contrast and reduced-motion behaviour.

### Phase 2 — Shared components
- Build foundations and migrate repeated controls first.
- Migrate navigation, feedback, data display, and editor controls next.
- Remove old duplicate CSS only after all usages are migrated and tested.

### Phase 3 — Platform Design Studio
- Add internal draft library, metadata, previews, responsive checks, publish pointer, history, and rollback.
- Keep theme management isolated from owner participant/payment-data permissions.
- Start with local/repository-backed theme definitions if that is safer; add database persistence only after the contract and access model are reviewed.

### Phase 4 — Organizer template engine
- Extract the existing seven templates into a central registry without changing their identifiers or breaking saved drafts.
- Improve those templates and add category-specific variants.
- Separate reusable event theme tokens/layouts from event content and branding values.
- Ensure old published events render correctly when a template version changes.

### Phase 5 — Organizer theme gallery
- Publish approved themes to the public gallery.
- Add preview and apply flows that preserve event content and existing URLs.
- Add organizer-level draft/published versions and rollback where safe.

### Phase 6 — Quality and release
- Test every route and interactive control on mobile and desktop.
- Run release checks and production-like privacy integration tests.
- Review migrations and RLS independently; UI themes must not weaken data access.
- Deploy only after required checks pass; verify the actual Cloudflare Pages deployment and Supabase function/migration state separately.

## Non-negotiable acceptance checklist

- [ ] Every shared button, tab, field, card, popup, menu, table, and editor control uses the shared component system.
- [ ] Platform theme changes apply consistently across all platform routes.
- [ ] Event theme changes apply only to the selected event's public experience.
- [ ] Platform and event themes cannot override one another's scope.
- [ ] Preview does not change production.
- [ ] Publish creates a versioned immutable snapshot.
- [ ] Rollback restores the previous visual version.
- [ ] Theme changes preserve event IDs, slugs, content, registrations, and payment evidence.
- [ ] Existing organizer-only RLS boundaries remain unchanged and pass two-organizer privacy tests.
- [ ] No owner dashboard feature exposes participant data or payment evidence.
- [ ] No unsafe HTML/script injection or arbitrary CSS execution is possible.
- [ ] Mobile, keyboard, contrast, and reduced-motion checks pass.
- [ ] Release and deployment evidence is recorded before calling a release live.

## First implementation slice

Start with a non-breaking foundation PR:
1. Add semantic token files matching the current production baseline.
2. Add a typed theme contract and registry with the existing baseline theme.
3. Add a scoped ThemeProvider that only sets approved CSS custom properties.
4. Add tests for token validation, target isolation, and fallback to the baseline theme.
5. Do not change the visual design, database, auth flow, or production theme in this PR.

This foundation lets future weekly/monthly designs be authored as versions and safely promoted, while the same theme technology can later power organizer templates.
