ALTER TABLE "Class"
  ADD COLUMN IF NOT EXISTS "secondaryCoachId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Class_secondaryCoachId_fkey'
      AND table_name = 'Class'
  ) THEN
    ALTER TABLE "Class"
      ADD CONSTRAINT "Class_secondaryCoachId_fkey"
      FOREIGN KEY ("secondaryCoachId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Class_secondaryCoachId_idx" ON "Class"("secondaryCoachId");
