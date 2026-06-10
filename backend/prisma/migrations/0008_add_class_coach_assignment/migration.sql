ALTER TABLE "Class"
  ADD COLUMN IF NOT EXISTS "coachId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Class_coachId_fkey'
      AND table_name = 'Class'
  ) THEN
    ALTER TABLE "Class"
      ADD CONSTRAINT "Class_coachId_fkey"
      FOREIGN KEY ("coachId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Class_coachId_idx" ON "Class"("coachId");
