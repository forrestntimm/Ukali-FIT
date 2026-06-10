import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/App.tsx",
  "utf8"
);

const loginSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/pages/LoginPage.tsx",
  "utf8"
);

const splashSourcePath =
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/components/BrandedSplash.tsx";

const globalStyles = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/styles/global.css",
  "utf8"
);

test("admin app uses a shared branded splash for startup loading", () => {
  assert.ok(fs.existsSync(splashSourcePath), "shared branded splash component should exist");
  assert.match(appSource, /import BrandedSplash from "\.\/components\/BrandedSplash"/);
  assert.match(appSource, /return <BrandedSplash title="Ukali Admin" subtitle="Loading your dashboard\.\.\." \/>;/);
});

test("admin login page uses the branded splash shell", () => {
  assert.match(loginSource, /import BrandedSplash from "\.\.\/components\/BrandedSplash"/);
  assert.match(loginSource, /<BrandedSplash[\s\S]*title="Ukali Admin"[\s\S]*subtitle="Sign in to manage the gym\."[\s\S]*>/);
});

test("global styles include branded splash background treatment", () => {
  assert.match(globalStyles, /\.branded-splash/);
  assert.match(globalStyles, /backdrop-filter: blur\(12px\)/);
});
