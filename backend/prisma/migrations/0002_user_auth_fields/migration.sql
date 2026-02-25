-- Align User table with current Prisma schema expectations.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "supabaseUserId" text,
  ADD COLUMN IF NOT EXISTS "inviteSentAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "inviteAcceptedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "lastLoginAt" timestamptz;

ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_supabaseUserId_key" ON "User"("supabaseUserId");
