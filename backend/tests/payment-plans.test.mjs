import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const paymentPlansPath = path.resolve(path.join(packageRoot, 'src/services/paymentPlans.ts'));
const paymentRoutesPath = path.resolve(path.join(packageRoot, 'src/routes/payments.ts'));
const paymentServicePath = path.resolve(path.join(packageRoot, 'src/services/paymentService.ts'));
const schemaPath = path.resolve(path.join(packageRoot, 'prisma/schema.prisma'));
const classServicePath = path.resolve(path.join(packageRoot, 'src/services/classService.ts'));
const checkInQrServicePath = path.resolve(path.join(packageRoot, 'src/services/checkInQr.ts'));
const userServicePath = path.resolve(path.join(packageRoot, 'src/services/userService.ts'));
const userRoutesPath = path.resolve(path.join(packageRoot, 'src/routes/users.ts'));
const schedulingRoutesPath = path.resolve(path.join(packageRoot, 'src/routes/scheduling.ts'));
const classRoutesPath = path.resolve(path.join(packageRoot, 'src/routes/classes.ts'));

test('backend defines gym payment plan presets including per-class kids pricing', () => {
  assert.ok(fs.existsSync(paymentPlansPath), 'backend should expose shared payment plan definitions');

  const source = fs.readFileSync(paymentPlansPath, 'utf8');
  assert.match(source, /KIDS_CLASS/, 'payment plans should include the kids class option');
  assert.match(source, /amount:\s*200/, 'kids class should cost 200 NPR');
  assert.match(source, /quantityEnabled:\s*true/, 'kids class should allow quantity selection');
  assert.match(source, /DROP_IN/, 'payment plans should include drop in pricing');
  assert.match(source, /YEAR_MEMBERSHIP/, 'payment plans should include year membership pricing');
  assert.match(source, /GOLD_MEMBER/, 'payment plans should include Gold Member pricing');
  assert.match(source, /name:\s*"Gold Member"[\s\S]*amount:\s*6000/, 'Gold Member should cost 6000 NPR');
});

test('manual payment route accepts a plan code and exposes payment plans to clients', () => {
  const source = fs.readFileSync(paymentRoutesPath, 'utf8');

  assert.match(source, /router\.get\("\/plans"/, 'payments routes should expose a /plans endpoint');
  assert.match(source, /planCode:/, 'manual payment schema should require a planCode');
  assert.match(source, /quantity:/, 'manual payment schema should support plan quantities');
});

test('backend exposes an admin income report for website revenue tracking', () => {
  const routeSource = fs.readFileSync(paymentRoutesPath, 'utf8');
  const serviceSource = fs.readFileSync(paymentServicePath, 'utf8');

  assert.match(routeSource, /router\.get\("\/income",\s*requireAuth,\s*requireRole\("ADMIN"\)/, 'income report should be admin-only');
  assert.match(serviceSource, /export async function getIncomeReport/, 'payment service should build a shared income report');
  assert.match(serviceSource, /where:\s*{\s*status:\s*PaymentState\.SUCCESS\s*}/, 'income totals should only count successful payments');
  assert.match(serviceSource, /today:\s*0/, 'income report should expose today totals');
  assert.match(serviceSource, /week:\s*0/, 'income report should expose week totals');
  assert.match(serviceSource, /month:\s*0/, 'income report should expose month totals');
  assert.match(serviceSource, /year:\s*0/, 'income report should expose year totals');
  assert.match(serviceSource, /allTime:\s*0/, 'income report should expose all-time totals');
  assert.match(serviceSource, /byMethod/, 'income report should group by payment method');
  assert.match(serviceSource, /byPlan/, 'income report should group by plan');
  assert.match(serviceSource, /unpaidMembers/, 'income report should include outstanding members');
});

test('manual payment service stores the chosen plan metadata on the payment record', () => {
  const source = fs.readFileSync(paymentServicePath, 'utf8');

  assert.match(source, /planCode/, 'manual payment service should accept a planCode');
  assert.match(source, /planName/, 'manual payment service should store the human-readable plan name');
  assert.match(source, /quantity/, 'manual payment service should store payment quantity');
});

test('manual payment service only records payments for activated athlete profiles', () => {
  const source = fs.readFileSync(paymentServicePath, 'utf8');
  const routeSource = fs.readFileSync(paymentRoutesPath, 'utf8');

  assert.match(source, /Role\s*}/, 'payment service should import Role for target validation');
  assert.match(source, /assertManualPaymentTarget\(userId\)/, 'manual payments should validate the target user before creating a payment');
  assert.match(source, /role:\s*true,[\s\S]*inviteAcceptedAt:\s*true,[\s\S]*lastLoginAt:\s*true/s, 'target validation should load role and activation fields');
  assert.match(source, /user\.role !== Role\.MEMBER/, 'target validation should reject non-athlete accounts');
  assert.match(source, /!user\.inviteAcceptedAt && !user\.lastLoginAt/, 'target validation should reject placeholder athletes that never accepted or logged in');
  assert.match(routeSource, /PAYMENT_MANUAL_FAILED/, 'manual payment route should return a structured error for service rejections');
});

test('payment schema stores plan metadata for history and reporting', () => {
  const source = fs.readFileSync(schemaPath, 'utf8');

  assert.match(source, /planCode\s+String\?/, 'payment model should store a plan code');
  assert.match(source, /planName\s+String\?/, 'payment model should store a plan name');
  assert.match(source, /quantity\s+Int/, 'payment model should store quantity information');
});

test('upcoming classes query keeps signup payload lean for mobile schedule screens', () => {
  const source = fs.readFileSync(classServicePath, 'utf8');
  const listUpcomingClassesSource = source.match(/export async function listUpcomingClasses\([\s\S]*?\n}\n/)?.[0] ?? '';

  assert.doesNotMatch(listUpcomingClassesSource, /signups:\s*true/, 'class list queries should not include full signup records');
  assert.match(listUpcomingClassesSource, /signups:\s*{\s*select:\s*{\s*id:\s*true,\s*userId:\s*true,\s*checkedInAt:\s*true/s, 'class list queries should select only the signup fields the apps need');
  assert.match(listUpcomingClassesSource, /addUtcDays\(from,\s*14\)/, 'mobile class list should default to a short upcoming window instead of downloading the ten-year schedule');
  assert.match(listUpcomingClassesSource, /take:\s*limit/, 'mobile class list should cap response size at the database query');
});

test('upcoming class coach filter includes primary and secondary assignments', () => {
  const source = fs.readFileSync(classServicePath, 'utf8');
  const listUpcomingClassesSource = source.match(/export async function listUpcomingClasses\([\s\S]*?\n}\n/)?.[0] ?? '';

  assert.match(
    listUpcomingClassesSource,
    /coachAssignmentWhere\s*=\s*coachId\s*\?\s*{\s*OR:\s*\[\s*{\s*coachId\s*},\s*{\s*secondaryCoachId:\s*coachId\s*}\s*]\s*}/s,
    'full upcoming class queries should include secondary coach assignments when filtering by coach'
  );
  assert.doesNotMatch(
    listUpcomingClassesSource,
    /coachId:\s*coachId \|\| undefined/,
    'full upcoming class queries should not filter only by primary coach'
  );
});

test('backend exposes a lightweight coaches-only list for scheduling', () => {
  const serviceSource = fs.readFileSync(userServicePath, 'utf8');
  const routeSource = fs.readFileSync(userRoutesPath, 'utf8');
  const listCoachUsersSource = serviceSource.match(/export async function listCoachUsers\([\s\S]*?\n}\n/)?.[0] ?? '';

  assert.match(serviceSource, /export async function listCoachUsers\(/, 'user service should expose a coaches-only query');
  assert.match(listCoachUsersSource, /where:\s*{\s*role:\s*Role\.ADMIN\s*}/s, 'coach query should only load admin users');
  assert.doesNotMatch(listCoachUsersSource, /classSignups:/, 'coach query should not pull class signup metrics');
  assert.match(routeSource, /router\.get\("\/coaches"/, 'users routes should expose a dedicated /coaches endpoint');
});

test('scheduling route uses a lightweight scheduling classes query', () => {
  const serviceSource = fs.readFileSync(classServicePath, 'utf8');
  const routeSource = fs.readFileSync(schedulingRoutesPath, 'utf8');
  const schedulingQuerySource = serviceSource.match(/export async function listSchedulingClasses\([\s\S]*?\n}\n/)?.[0] ?? '';

  assert.match(serviceSource, /export async function listSchedulingClasses\(/, 'class service should expose a lightweight scheduling query');
  assert.doesNotMatch(schedulingQuerySource, /signups:/, 'scheduling query should not include signup payloads');
  assert.match(routeSource, /listSchedulingClasses/, 'scheduling route should use the dedicated lightweight query');
});

test('scheduling route can create editable coach slots from the admin grid', () => {
  const serviceSource = fs.readFileSync(classServicePath, 'utf8');
  const routeSource = fs.readFileSync(schedulingRoutesPath, 'utf8');
  const schedulingQuerySource = serviceSource.match(/export async function listSchedulingClasses\([\s\S]*?\n}\n/)?.[0] ?? '';

  assert.match(routeSource, /router\.post\("\/classes"/, 'scheduling route should let admins save open schedule slots');
  assert.match(routeSource, /upsertSchedulingClass/, 'scheduling route should persist coach slot assignments');
  assert.match(serviceSource, /export async function upsertSchedulingClass\(/, 'class service should expose scheduling upsert logic');
  assert.match(serviceSource, /assertOptionalCoachExists\(input\.primaryCoachId\)/, 'scheduling upsert should validate primary admin coaches');
  assert.match(serviceSource, /assertOptionalCoachExists\(input\.secondaryCoachId\)/, 'scheduling upsert should validate secondary admin coaches');
  assert.doesNotMatch(
    schedulingQuerySource,
    /removeBlockedClassTimes/,
    'admin scheduling view should keep the explicit 5 PM slot visible'
  );
});

test('check-in QR codes are persisted per user and scanner accepts the stable prefixed payload', () => {
  const schemaSource = fs.readFileSync(schemaPath, 'utf8');
  const checkInQrSource = fs.readFileSync(checkInQrServicePath, 'utf8');
  const classServiceSource = fs.readFileSync(classServicePath, 'utf8');

  assert.match(schemaSource, /checkInQrCode\s+String\s+@unique\s+@default\(uuid\(\)\)/, 'user schema should persist a unique QR code by default');
  assert.match(checkInQrSource, /ukali-checkin:v1:/, 'QR normalization should recognize the stable Ukali QR prefix');
  assert.match(classServiceSource, /normalizeCheckInQrCode\(qrCode\)/, 'class check-in should normalize QR payloads before looking up the member');
  assert.match(classServiceSource, /where:\s*{\s*checkInQrCode:\s*normalizedCode\s*}/s, 'class check-in should still resolve members by their persisted QR code');
});

test('coach class summary route limits the mobile classes payload', () => {
  const classServiceSource = fs.readFileSync(classServicePath, 'utf8');
  const classRoutesSource = fs.readFileSync(classRoutesPath, 'utf8');
  const listAssignedSummariesSource = classServiceSource.match(/export async function listAssignedClassSummaries\([\s\S]*?\n}\n/)?.[0] ?? '';

  assert.match(classRoutesSource, /const limit = typeof req\.query\.limit === "string" \? Number\.parseInt\(req\.query\.limit, 10\) : undefined;/, 'classes route should parse an optional summary limit');
  assert.match(classRoutesSource, /listAssignedClassSummaries\(\{\s*coachId,\s*limit\s*}\)/s, 'classes route should pass the summary limit into the service');
  assert.match(listAssignedSummariesSource, /const limit = Math\.max\(1, Math\.min\(args\.limit \?\? 20, 50\)\);/, 'assigned class summaries should clamp the requested limit to a fast mobile-friendly range');
  assert.match(listAssignedSummariesSource, /take:\s*limit/, 'assigned class summaries should apply the limit directly in the database query');
});
