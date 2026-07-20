import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const userRoutesPath = path.resolve(path.join(packageRoot, "src/routes/users.ts"));
const userServicePath = path.resolve(path.join(packageRoot, "src/services/userService.ts"));
const classRoutesPath = path.resolve(path.join(packageRoot, "src/routes/classes.ts"));
const classServicePath = path.resolve(path.join(packageRoot, "src/services/classService.ts"));
const workoutRoutesPath = path.resolve(path.join(packageRoot, "src/routes/workouts.ts"));

test("backend exposes lightweight member options and stats queries for admin surfaces", () => {
  const routeSource = fs.readFileSync(userRoutesPath, "utf8");
  const serviceSource = fs.readFileSync(userServicePath, "utf8");
  const memberOptionsSource = serviceSource.match(/export async function listMemberOptions\([\s\S]*?\n}\n/)?.[0] ?? "";
  const dashboardStatsSource = serviceSource.match(/export async function getMemberDashboardStats\([\s\S]*?\n}\n/)?.[0] ?? "";

  assert.match(serviceSource, /export async function listMemberOptions\(/, "user service should expose lightweight member options");
  assert.match(serviceSource, /export async function getMemberDashboardStats\(/, "user service should expose lightweight dashboard stats");
  assert.match(routeSource, /router\.get\("\/member-options"/, "users routes should expose a member-options endpoint");
  assert.match(routeSource, /router\.get\("\/stats"/, "users routes should expose a stats endpoint");
  assert.doesNotMatch(
    memberOptionsSource,
    /classSignups:/,
    "member options query should not pull class signup metrics"
  );
  assert.doesNotMatch(
    memberOptionsSource,
    /checkInQrCode:/,
    "member options query should not expose QR codes to picker surfaces"
  );
  assert.doesNotMatch(
    dashboardStatsSource,
    /checkInQrCode:/,
    "dashboard stats query should not expose per-user QR data"
  );
  assert.match(
    dashboardStatsSource,
    /FROM "ClassSignup"/,
    "dashboard stats should aggregate athlete app check-in activity"
  );
  assert.match(
    dashboardStatsSource,
    /FROM "WorkoutLog"/,
    "dashboard stats should aggregate athlete workout logs"
  );
  assert.match(
    dashboardStatsSource,
    /FROM "CoachClassSession"/,
    "dashboard stats should aggregate coach app class sessions"
  );
  assert.match(
    dashboardStatsSource,
    /prisma\.\$queryRaw/,
    "dashboard stats should use one database round trip instead of competing for the serverless connection pool"
  );
  assert.match(
    dashboardStatsSource,
    /readResponseCache/,
    "dashboard stats should cache hot dashboard recall briefly"
  );
  assert.match(
    dashboardStatsSource,
    /json_agg\(/,
    "dashboard stats should return a chart-ready activity series"
  );
});

test("admin member list omits heavyweight base64 profile images", () => {
  const serviceSource = fs.readFileSync(userServicePath, "utf8");
  const listUsersSource = serviceSource.match(/export async function listUsers\([\s\S]*?\n}\n/)?.[0] ?? "";

  assert.match(
    serviceSource,
    /const \{ profileImageDataUrl: _omitProfileImage, \.\.\.userListMetricsSelect \}/,
    "user service should derive a list select that omits the base64 profile image"
  );
  assert.match(
    listUsersSource,
    /select:\s*userListMetricsSelect/,
    "listUsers should use the image-free list select so /users stays lightweight"
  );
});

test("auth middleware resolves identity without refetching the full profile per request", () => {
  const authMiddlewareSource = fs.readFileSync(
    path.join(packageRoot, "src", "middleware", "auth.ts"),
    "utf8"
  );
  const supabaseAuthSource = fs.readFileSync(
    path.join(packageRoot, "src", "services", "supabaseAuthService.ts"),
    "utf8"
  );

  assert.match(
    authMiddlewareSource,
    /resolveAuthUserFromSupabaseToken/,
    "requireAuth should use the lightweight cached auth resolver"
  );
  assert.match(
    supabaseAuthSource,
    /if \(!options\.includeProfile\) \{\s*return \{ user: undefined, authUser \};/s,
    "full profile loads should be opt-in for bootstrap-style callers only"
  );
  assert.match(
    supabaseAuthSource,
    /AUTH_CACHE_TTL_MS/,
    "supabase token resolution should be cached briefly to avoid a network round trip per request"
  );
});

test("notification queries select device tokens narrowly instead of full user rows", () => {
  const notificationSource = fs.readFileSync(
    path.join(packageRoot, "src", "services", "notificationService.ts"),
    "utf8"
  );

  assert.doesNotMatch(
    notificationSource,
    /include:\s*\{\s*deviceTokens:\s*true\s*\}/,
    "notification queries should not drag full user rows (profile images) through pushes"
  );
  assert.match(
    notificationSource,
    /deviceTokens:\s*\{\s*select:\s*deviceTokenSelect\s*\}/,
    "notification queries should select only device token fields"
  );
});

test("class signup capacity check counts signups instead of loading them", () => {
  const serviceSource = fs.readFileSync(classServicePath, "utf8");
  const signupSource = serviceSource.match(/export async function signUpForClass\([\s\S]*?\n}\n/)?.[0] ?? "";

  assert.match(signupSource, /_count:\s*\{\s*select:\s*\{\s*signups:\s*true/s, "signup should ask the database for a count");
  assert.match(signupSource, /klass\._count\.signups >= klass\.capacity/, "capacity check should compare against the counted value");
});

test("coach summary route supports lightweight class loading for dashboard and scan flows", () => {
  const routeSource = fs.readFileSync(classRoutesPath, "utf8");
  const serviceSource = fs.readFileSync(classServicePath, "utf8");
  const assignedSummariesSource = serviceSource.match(/export async function listAssignedClassSummaries\([\s\S]*?\n}\n/)?.[0] ?? "";

  assert.match(
    routeSource,
    /listAssignedClassSummaries\(\{\s*coachId,\s*limit\s*}\)/s,
    "classes route should keep using the summary service for coach summary requests"
  );
  assert.match(
    assignedSummariesSource,
    /reservationCount/,
    "assigned class summaries should expose reservation counts for fast coach views"
  );
  assert.match(
    assignedSummariesSource,
    /checkedInCount/,
    "assigned class summaries should expose checked-in counts for fast coach views"
  );
  assert.match(
    assignedSummariesSource,
    /coachAssignmentRole/,
    "assigned class summaries should expose whether the coach is assigned as primary or secondary"
  );
  assert.match(
    assignedSummariesSource,
    /OR:\s*\[\s*{\s*coachId:\s*args\.coachId\s*},\s*{\s*secondaryCoachId:\s*args\.coachId\s*}\s*]/s,
    "assigned class summaries should include both primary and secondary coaching assignments"
  );
  assert.doesNotMatch(
    assignedSummariesSource,
    /coach:\s*{/,
    "assigned class summaries should not include nested coach records"
  );
  assert.match(
    assignedSummariesSource,
    /gte:\s*from \|\| resolveAppDayStart\(\)/,
    "assigned class summaries should stay available for the whole Nepal day instead of disappearing once class time passes"
  );
});

test("classes route exposes a lightweight upcoming gym schedule summary", () => {
  const routeSource = fs.readFileSync(classRoutesPath, "utf8");
  const serviceSource = fs.readFileSync(classServicePath, "utf8");
  const upcomingSummariesSource = serviceSource.match(/export async function listUpcomingClassSummaries\([\s\S]*?\n}\n/)?.[0] ?? "";

  assert.match(
    routeSource,
    /if\s*\(summary\)\s*\{\s*const classes = await listUpcomingClassSummaries\(\{\s*limit\s*\}\);/s,
    "classes route should expose a lightweight summary path for general gym schedule requests"
  );
  assert.match(
    upcomingSummariesSource,
    /take:\s*limit/,
    "upcoming class summaries should honor the requested lightweight limit"
  );
  assert.match(
    upcomingSummariesSource,
    /status:\s*ClassStatus\.OPEN/,
    "upcoming class summaries should only surface open classes for the gym schedule fallback"
  );
  assert.doesNotMatch(
    upcomingSummariesSource,
    /signups:\s*{/,
    "upcoming class summaries should not pull nested signup payloads"
  );
});


test("classes route exposes a class workout lookup for coach dashboard selection", () => {
  const routeSource = fs.readFileSync(classRoutesPath, "utf8");
  const serviceSource = fs.readFileSync(classServicePath, "utf8");

  assert.match(
    routeSource,
    /router\.get\("\/:id\/workout",\s*requireAuth,\s*requireRole\("ADMIN"\)/,
    "classes routes should expose an authenticated workout lookup for a selected coaching class"
  );
  assert.match(
    serviceSource,
    /export async function getWorkoutForClass\(classId: string\)/,
    "class service should expose a helper that resolves the workout tied to a class date"
  );
  assert.match(
    serviceSource,
    /const klass = await prisma\.class\.findUnique\(/,
    "class workout lookup should load the class datetime before resolving the workout"
  );
  assert.match(
    serviceSource,
    /return findWorkoutForClassDate\(klass\.datetime\);/,
    "class workout lookup should reuse the class-date workout resolver instead of duplicating date logic"
  );
});

test("workouts today route can resolve the current workout from the caller timezone", () => {
  const routeSource = fs.readFileSync(workoutRoutesPath, "utf8");

  assert.match(
    routeSource,
    /x-ukali-time-zone/i,
    "workouts route should read an explicit client timezone header for timezone-aware daily WOD lookup"
  );
  assert.match(
    routeSource,
    /const today = resolveTodayForTimeZone\(timeZone\);/,
    "workouts route should resolve the current day using the caller timezone when it is provided"
  );
  assert.match(
    routeSource,
    /try\s*\{[\s\S]*new Intl\.DateTimeFormat\("en-CA",\s*\{\s*timeZone/,
    "workouts route should validate the provided timezone and fall back safely when it is invalid"
  );
});
