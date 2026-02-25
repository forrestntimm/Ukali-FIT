ALTER TABLE "ClassSignup"
  ADD COLUMN IF NOT EXISTS "checkedInAt" timestamp(3);
