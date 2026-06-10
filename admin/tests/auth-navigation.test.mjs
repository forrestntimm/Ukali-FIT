import assert from "node:assert/strict";
import test from "node:test";
import { shouldRouteToDashboardAfterAuth } from "../src/utils/auth-navigation.js";

test("routes to dashboard after auth when currently on login routes", () => {
  assert.equal(shouldRouteToDashboardAfterAuth("/login"), true);
  assert.equal(shouldRouteToDashboardAfterAuth("/auth/callback"), true);
});

test("does not force dashboard redirect for in-app tabs", () => {
  assert.equal(shouldRouteToDashboardAfterAuth("/"), false);
  assert.equal(shouldRouteToDashboardAfterAuth("/members"), false);
  assert.equal(shouldRouteToDashboardAfterAuth("/payments"), false);
  assert.equal(shouldRouteToDashboardAfterAuth("/wod"), false);
  assert.equal(shouldRouteToDashboardAfterAuth("/classes"), false);
  assert.equal(shouldRouteToDashboardAfterAuth("/coaching-schedule"), false);
  assert.equal(shouldRouteToDashboardAfterAuth("/announcements"), false);
});
