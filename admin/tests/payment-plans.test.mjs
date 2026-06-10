import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const paymentsPagePath = path.resolve('/Users/forresttimm/Documents/Ukali sign in app/admin/src/pages/PaymentsPage.tsx');

test('admin payments page loads plan presets instead of relying on freeform amount entry', () => {
  const source = fs.readFileSync(paymentsPagePath, 'utf8');

  assert.match(source, /\/payments\/plans/, 'admin payments page should fetch shared payment plans from the backend');
  assert.match(source, /planCode/, 'admin payments page should track the selected payment plan');
  assert.match(source, /quantity/, 'admin payments page should support quantities for per-class plans');
  assert.match(source, /Selected plan|Payment option|Select payment option/, 'admin payments page should render a payment option chooser');
});

test('admin payments page renders payment plans as visible grouped options instead of a plain plan dropdown', () => {
  const source = fs.readFileSync(paymentsPagePath, 'utf8');

  assert.match(source, /membershipPlans/, 'admin payments page should split membership plans into a visible group');
  assert.match(source, /perClassPlans/, 'admin payments page should split per-class plans into a visible group');
  assert.match(source, /payment-plan-option/, 'admin payments page should render clickable payment plan option cards');
  assert.doesNotMatch(source, /<select value=\{form\.planCode\}/, 'admin payments page should not use a plain select for payment plans');
});
