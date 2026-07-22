import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const paymentsPagePath = path.resolve(path.join(packageRoot, 'src/pages/PaymentsPage.tsx'));

test('admin payments page loads plan presets instead of relying on freeform amount entry', () => {
  const source = fs.readFileSync(paymentsPagePath, 'utf8');

  assert.match(source, /\/payments\/plans/, 'admin payments page should fetch shared payment plans from the backend');
  assert.match(source, /planCode/, 'admin payments page should track the selected payment plan');
  assert.match(source, /quantity/, 'admin payments page should support quantities for per-class plans');
  assert.match(source, /Selected plan|Payment option|Select payment option/, 'admin payments page should render a payment option chooser');
});

test('admin payments page renders payment plans in a dropdown menu', () => {
  const source = fs.readFileSync(paymentsPagePath, 'utf8');

  assert.match(source, /<select[\s\S]*value=\{form\.planCode\}/, 'admin payments page should use a plan dropdown');
  assert.match(source, /Select payment option/, 'plan dropdown should have a clear placeholder');
  assert.match(source, /plan\.name} - \{plan\.amount} \{plan\.currency}/, 'dropdown options should show name and price');
  assert.doesNotMatch(source, /payment-plan-option/, 'admin payments page should not render large plan option cards');
});

test('admin payments page tracks income from recorded payments', () => {
  const source = fs.readFileSync(paymentsPagePath, 'utf8');

  assert.match(source, /\/payments\/income/, 'payments page should fetch the income report');
  assert.match(source, /Income Tracking/, 'payments page should present a revenue tracking section');
  assert.match(source, /This Month/, 'payments page should show month-to-date income');
  assert.match(source, /By Payment Method/, 'payments page should show payment method totals');
  assert.match(source, /Recent Payments/, 'payments page should show recent income activity');
  assert.match(source, /Outstanding Members/, 'payments page should surface unpaid members');
});
