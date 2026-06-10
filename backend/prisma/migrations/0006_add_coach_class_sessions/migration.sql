CREATE TABLE IF NOT EXISTS "CoachClassSession" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "coachId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "classId" uuid NOT NULL REFERENCES "Class"("id") ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("coachId", "classId")
);

CREATE INDEX IF NOT EXISTS "CoachClassSession_coachId_idx" ON "CoachClassSession"("coachId");
CREATE INDEX IF NOT EXISTS "CoachClassSession_classId_idx" ON "CoachClassSession"("classId");
