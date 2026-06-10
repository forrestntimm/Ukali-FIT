import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const paymentPlansPath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/backend/src/services/paymentPlans.ts');
const paymentRoutesPath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/backend/src/routes/payments.ts');
const paymentServicePath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/backend/src/services/paymentService.ts');
const schemaPath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/backend/prisma/schema.prisma');
const classServicePath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/backend/src/services/classService.ts');
const checkInQrServicePath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/backend/src/services/checkInQr.ts');
const userServicePath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/backend/src/services/userService.ts');
const userRoutesPath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/backend/src/routes/users.ts');
const schedulingRoutesPath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/backend/src/routes/scheduling.ts');
const classRoutesPath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/backend/src/routes/classes.ts');

test('backend defines gym payment plan presets including per-class kids pricing', () => {
  assert.ok(fs.existsSync(paymentPlansPath), 'backend should expose shared payment plan definitions');

  const source = fs.readFileSync(paymentPlansPath, 'utf8');
  assert.match(source, /KIDS_CLASS/, 'payment plans should include the kids class option');
  assert.match(source, /amount:\s*200/, 'kids class should cost 200 NPR');
  assert.match(source, /quantityEnabled:\s*true/, 'kids class should allow quantity selection');
  assert.match(source, /DROP_IN/, 'payment plans should include drop in pricing');
  assert.match(source, /YEAR_MEMBERSHIP/, 'payment plans should include year membership pricing');
});

test('manual payment route accepts a plan code and exposes payment plans to clients', () => {
  const source = fs.readFileSync(paymentRoutesPath, 'utf8');

  assert.match(source, /router\.get\("\/plans"/, 'payments routes should expose a /plans endpoint');
  assert.match(source, /planCode:/, 'manual payment schema should require a planCode');
  assert.match(source, /quantity:/, 'manual payment schema should support plan quantities');
});

test('manual payment service stores the chosen plan metadata on the payment record', () => {
  const source = fs.readFileSync(paymentServicePath, 'utf8');

  assert.match(source, /planCode/, 'manual payment service should accept a planCode');
  assert.match(source, /planName/, 'manual payment service should store the human-readable plan name');
  assert.match(source, /quantity/, 'manual payment service should store payment quantity');
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
