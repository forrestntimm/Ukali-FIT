ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "webAccessApproved" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "webAccessApprovedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "webAccessApprovedById" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'User_webAccessApprovedById_fkey'
      AND table_name = 'User'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_webAccessApprovedById_fkey"
      FOREIGN KEY ("webAccessApprovedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_webAccessApproved_idx" ON "User"("webAccessApproved");
CREATE INDEX IF NOT EXISTS "User_webAccessApprovedById_idx" ON "User"("webAccessApprovedById");

UPDATE "User"
SET
  "webAccessApproved" = true,
  "webAccessApprovedAt" = COALESCE("webAccessApprovedAt", now())
WHERE "role" = 'ADMIN';
