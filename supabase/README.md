# Supabase Schema & Policy Workflow

This directory tracks Supabase-specific schema security checks and policy state as code.

## Ownership split
- `backend/prisma/*`: source of truth for app/business schema (`User`, `Payment`, `Class`, etc.)
- `supabase/migrations/*`: Supabase-specific policy/security assertions and auth-adjacent SQL

## Current baseline
- `20260228232000_baseline_security_policy_audit.sql`
  - validates expected table set exists
  - validates no direct `anon`/`authenticated` grants on backend-owned tables
  - validates RLS + baseline policies exist for `profiles` and `attendance`

## How to run
From repository root:

```bash
supabase migration list
supabase db push
```

## Notes
- This project currently uses Supabase for auth and backend Postgres for business data access.
- Admin/mobile do not query business tables directly from Supabase client SDK.
- If you later move data access to direct Supabase client queries, expand RLS/policies before shipping.
