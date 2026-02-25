ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "age" integer,
  ADD COLUMN IF NOT EXISTS "fitnessGoals" text,
  ADD COLUMN IF NOT EXISTS "checkInQrCode" text;

UPDATE "User"
SET "checkInQrCode" = gen_random_uuid()::text
WHERE "checkInQrCode" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "checkInQrCode" SET NOT NULL,
  ALTER COLUMN "checkInQrCode" SET DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX IF NOT EXISTS "User_checkInQrCode_key" ON "User"("checkInQrCode");
