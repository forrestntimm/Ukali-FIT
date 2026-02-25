# Backend Clone Runbook (Ukali Pattern)

Use this to spin up a new client backend with the same auth flow and avoid the failures we just hit.

## What We Confirmed Works

- Mobile app sends OTP with Supabase: `signInWithOtp`.
- App verifies 6-digit code with `verifyOtp({ type: "email" })`.
- Backend bootstrap validates Supabase JWT, links/create local user, returns app profile.
- Redirect/deep link uses `ukali://auth/callback`.

Code references:
- `mobile/src/context/AuthContext.tsx`
- `mobile/src/lib/supabase.ts`
- `backend/src/services/supabaseAuthService.ts`
- `backend/src/routes/auth.ts`

## Required Defaults For Every New Client

1. Supabase Auth URL config:
- `site_url = ukali://auth/callback`
- allow list includes `ukali://auth/callback`

2. Supabase Magic Link template must be OTP-first:

```html
<h2>Your verification code</h2>
<p>Enter this code in the app:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:4px;">{{ .Token }}</p>
<p>If you didn't request this, ignore this email.</p>
```

3. Mobile OTP send must allow first login:
- `shouldCreateUser: true`

4. Backend must auto-provision local user on first valid Supabase auth:
- create local MEMBER user when email is valid but local record is missing
- then link `supabaseUserId`

## New Client Setup Checklist

1. Clone repo and create client-specific branch/workspace.
2. Create a new Supabase project for that client.
3. Set backend env from `backend/.env.example`:
- `DATABASE_URL`, `DIRECT_URL`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `MOBILE_CALLBACK_URL=ukali://auth/callback`
4. Set mobile env:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_MAGIC_LINK_REDIRECT_URL=ukali://auth/callback`
5. Run backend setup:
- `npm install`
- `npm run prisma:generate`
- `npm run prisma:deploy` (or `npm run prisma:migrate` in dev)
- `npm run seed`
6. In Supabase dashboard:
- set URL config
- set Magic Link template to include `{{ .Token }}`
7. Start backend: `npm run dev`
8. Start mobile: `npm start`
9. Validate OTP flow end-to-end on simulator.

## Preflight Validation Commands

Use Supabase Management API to verify live config (replace `PROJECT_REF`):

```bash
curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/PROJECT_REF/config/auth" | \
  jq '{site_url, uri_allow_list, mailer_subjects_magic_link, mailer_templates_magic_link_content}'
```

Expected:
- `site_url` and `uri_allow_list` point to `ukali://auth/callback`
- `mailer_templates_magic_link_content` contains `{{ .Token }}`

## Failure Patterns We Hit (And Fixes)

1. Email contains only `Log In` link, no code:
- cause: default Supabase template still active
- fix: patch Magic Link template with `{{ .Token }}`

2. "sign ups not allowed for otp":
- cause: `shouldCreateUser: false` for first-time user
- fix: set `shouldCreateUser: true`

3. Valid Supabase session but blocked in app bootstrap:
- cause: no local DB user provisioned
- fix: backend auto-creates local user on first auth, then links identity

4. Link opens `localhost` and fails:
- cause: wrong URL config/template behavior for mobile auth
- fix: code-first OTP flow + deep link redirect config

## Recommendation For Reuse At Scale (4-5 Clients)

1. Keep one codebase.
2. Use one Supabase project + one database per client.
3. Use per-client env files and a per-client setup checklist.
4. Add an automated "auth preflight" step before every launch:
- verify Supabase template and redirect config via API
- run mobile login smoke test on simulator
