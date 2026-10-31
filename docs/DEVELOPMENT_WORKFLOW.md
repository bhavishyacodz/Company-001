# Company-001 development and release workflow

## Environments

| Environment | Purpose | Rule |
|---|---|---|
| Local | Fast developer feedback | Use locked dependencies and safe test data |
| Pull-request preview | Review one isolated change | Never treat it as production |
| Integration | Verify compatible completed features together | Deploy only after required checks pass |
| Production | Real organisers and participants | Only verified release commits |

Production hosting is Cloudflare Pages. Do not configure or describe the project as Cloudflare Workers. Keep GitHub Actions build status separate from Cloudflare Pages deployment status.

## Branch policy

### Permanent branches

- `main`: production source; protected by review and required checks where repository settings allow.
- `develop`: integration branch, to be introduced only after the currently open security/UI dependency chain has been reconciled. Do not create a second competing integration line while the current PR stack is unresolved.

### Short-lived branches

Create from the agreed integration branch (currently `main` until the integration branch is formally established):

- `feature/ui-<short-name>`
- `feature/auth-<short-name>`
- `feature/editor-<short-name>`
- `feature/organizer-<short-name>`
- `feature/king-<short-name>`
- `fix/<short-name>`
- `chore/<short-name>`
- `security/<short-name>`

One branch = one coherent outcome. Do not build unrelated features on top of an unfinished feature branch. If a dependency is unavoidable, state it in the PR and merge in dependency order.

## Pull request rules

Every PR must:

1. State the user-visible behavior being changed.
2. Name the feature area and files/systems intentionally touched.
3. State what is explicitly out of scope.
4. Include mobile and desktop verification for UI changes.
5. Include loading, empty, error, and permission-state checks where relevant.
6. Include regression tests for the bug being fixed.
7. State whether routes, auth, database schema, RLS, Storage, Edge Functions, or secrets are affected.
8. Include privacy tests whenever participant data, evidence, or organiser ownership is touched.
9. Pass dependency audit, release invariants, build, and relevant automated tests.
10. Have a successful Cloudflare Pages preview before being marked ready for production.

Avoid giant PRs that combine redesign, routing, auth, data migrations, and unrelated features.

## Required verification gates

### Every change

- `npm ci`
- `npm audit --audit-level=low`
- `npm run test:release`
- `npm run build`

### UI/UX changes

- Public homepage and template gallery
- Google organiser login and returning organiser session
- King Login and owner-only route
- Organiser dashboard and all primary tabs
- Editor create/edit/save/preview flow
- Mobile viewport and desktop viewport
- Keyboard focus, touch targets, reduced-motion, overflow
- No stale CSS or legacy screen appearing after navigation/reload

### Auth/routing changes

- Signed-out user
- New organiser
- Existing organiser
- Owner account
- Unknown role
- Suspended organiser
- Expired/refreshing session
- OAuth callback and direct URL refresh
- Deep link to a public event

### Data/security changes

- Organiser A can read only A's own registrations and evidence.
- Organiser B can read only B's own registrations and evidence.
- Owner cannot read participant submissions or private evidence unless a separately documented, explicitly authorised policy says otherwise; the current product requirement is that owner cannot.
- Unauthenticated user cannot read private data.
- Storage object access and signed URL expiry are tested.
- RLS is the enforcement layer; UI hiding is not considered a security control.

## Release process

1. Merge only a reviewed PR whose base is the intended integration branch.
2. Wait for the exact merged commit's GitHub Actions checks.
3. Wait for the Cloudflare Pages deployment for that exact commit.
4. Open the immutable deployment URL and run the release smoke checklist.
5. Verify the production hostname only after production deployment is reported successful.
6. Record commit SHA, Actions run, Pages deployment, tested routes, and known limitations.
7. If verification fails, stop the release and fix forward in a new branch or roll back; do not stack speculative CSS overrides.

A successful GitHub Actions build is not proof that Cloudflare Pages deployed. A successful preview is not proof that production changed.

## Change request format

When requesting work, use this short format:

- Goal: what should change?
- Area: public / auth / organizer / editor / King / backend
- Expected behavior: what should happen?
- Must remain unchanged: routes, data, privacy, branding, etc.
- Verification: which flows must pass?

The assistant/developer should infer the rest from this architecture and the current codebase, and should not ask the user to repeat known project constraints.
