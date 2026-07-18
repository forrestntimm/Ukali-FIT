-- Dashboard activity rollups filter on these timestamps; without indexes each
-- /users/stats load scans the full ClassSignup/WorkoutLog/CoachClassSession tables.
CREATE INDEX IF NOT EXISTS "ClassSignup_checkedInAt_idx" ON "ClassSignup"("checkedInAt");
CREATE INDEX IF NOT EXISTS "WorkoutLog_checkedInAt_idx" ON "WorkoutLog"("checkedInAt");
CREATE INDEX IF NOT EXISTS "CoachClassSession_createdAt_idx" ON "CoachClassSession"("createdAt");
