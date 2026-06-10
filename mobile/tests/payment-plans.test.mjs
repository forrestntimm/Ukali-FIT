import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const adminPaymentsPath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/mobile/src/screens/AdminPaymentsManageScreen.tsx');
const athletePaymentsPath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/mobile/src/screens/PaymentsScreen.tsx');

test('mobile admin payments screen fetches plan presets and limits members to athletes', () => {
  const source = fs.readFileSync(adminPaymentsPath, 'utf8');

  assert.match(source, /\/payments\/plans/, 'mobile admin payments screen should fetch shared payment plans');
  assert.match(source, /role === "MEMBER"/, 'mobile admin payments screen should only show athlete accounts in the member picker');
  assert.match(source, /planCode/, 'mobile admin payments screen should track the selected payment plan');
  assert.match(source, /quantity/, 'mobile admin payments screen should support quantities for per-class plans');
  assert.match(source, /useAuth\(\)/, 'mobile admin payments screen should wait for auth context before loading protected payment data');
  assert.match(source, /authLoading \|\| user\?\.role !== "ADMIN"/, 'mobile admin payments screen should not fetch protected payment data until the admin session is ready');
});

test('athlete payments screen shows plan options with NPR pricing and payment history', () => {
  const source = fs.readFileSync(athletePaymentsPath, 'utf8');

  assert.match(source, /\/payments\/plans/, 'athlete payments screen should fetch available payment plans');
  assert.match(source, /NPR/, 'athlete payments screen should present Nepal pricing instead of USD');
  assert.match(source, /planName/, 'athlete payments history should render the saved plan name');
});
