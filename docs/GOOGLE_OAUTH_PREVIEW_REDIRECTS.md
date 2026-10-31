# Company-001 Google OAuth preview redirects

## Why this setting matters

The organiser Google sign-in flow deliberately sets `redirectTo` to the exact origin currently showing the app:

```js
redirectTo: window.location.origin + "/?auth_flow=organizer_google"
```

This is required so a login started on a Cloudflare Pages preview returns to that same preview instead of the production Site URL. Supabase only honours a `redirectTo` URL when it matches an entry in Authentication → URL Configuration → Redirect URLs. If the preview hostname is not allowed, Supabase may use the configured Site URL instead. That can make a new preview appear to work before login, but the OAuth return opens the production app.

## Supabase Auth URL Configuration

Keep the production Site URL set to:

`https://company-001.pages.dev`

Add these Redirect URLs:

- `https://company-001.pages.dev/**` — production
- `https://*.company-001.pages.dev/**` — Cloudflare Pages branch and commit previews
- `http://localhost:3000/**` — local development only

The wildcard is limited to the project's own `company-001.pages.dev` hostname family. Do not use a broad wildcard such as `https://**`.

## Google OAuth provider callback

The Google OAuth provider's authorised redirect URI remains the Supabase Auth callback URL shown in Supabase Authentication → Providers → Google. It is not the Cloudflare Pages preview URL. Do not replace it with a Pages URL.

## Manual release check

1. Open the exact Cloudflare Pages preview URL.
2. Confirm the browser address bar still shows the preview hostname.
3. Open User Login and choose Continue with Google.
4. After Google sign-in, confirm the browser returns to that same preview hostname and displays the updated organiser dashboard.
5. Repeat once on production and confirm production returns to `https://company-001.pages.dev`.

A successful Google authentication event alone does not prove the redirect destination is correct. Verify the final browser origin.
