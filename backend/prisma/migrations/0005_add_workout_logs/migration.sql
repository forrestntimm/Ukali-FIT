CREATE TABLE IF NOT EXISTS "WorkoutLog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "classId" uuid NOT NULL REFERENCES "Class"("id") ON DELETE CASCADE,
  "workoutId" uuid REFERENCES "Workout"("id") ON DELETE SET NULL,
  "checkedInAt" timestamptz NOT NULL,
  "weight" text,
  "completionTime" text,
  "movementScales" text,
  "coachNotes" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("userId", "classId")
);

CREATE INDEX IF NOT EXISTS "WorkoutLog_userId_checkedInAt_idx" ON "WorkoutLog"("userId", "checkedInAt");
CREATE INDEX IF NOT EXISTS "WorkoutLog_classId_idx" ON "WorkoutLog"("classId");
CREATE INDEX IF NOT EXISTS "WorkoutLog_workoutId_idx" ON "WorkoutLog"("workoutId");
