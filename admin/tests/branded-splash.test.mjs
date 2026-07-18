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

test("admin app falls back to Supabase session when cached auth token is stale", () => {
  assert.match(appSource, /const restoreSupabaseSession = async \(\) =>/, "app should centralize Supabase session restoration");
  assert.match(appSource, /clearCachedAuthToken\(\);[\s\S]*setAuthed\(false\);[\s\S]*finally[\s\S]*restoreSupabaseSession\(\)/, "stale cached token should not leave the app logged out before checking Supabase session");
});

test("admin login page uses the branded splash shell", () => {
  assert.match(loginSource, /import BrandedSplash from "\.\.\/components\/BrandedSplash"/);
  assert.match(loginSource, /<BrandedSplash[\s\S]*title="Ukali Admin"[\s\S]*subtitle="Sign in to manage the gym\."[\s\S]*>/);
});

test("admin login page can remember email and sign-in preference without storing passwords", () => {
  assert.match(loginSource, /admin_remember_login/, "login should persist the remember-me setting");
  assert.match(loginSource, /admin_remembered_email/, "login should remember the email on this device");
  assert.match(loginSource, /Keep me signed in/, "login should expose a keep-signed-in control");
  assert.doesNotMatch(loginSource, /localStorage\.setItem\([^)]*password/i, "login should never store passwords");
});

test("admin login page opens on email password and keeps magic code last", () => {
  assert.match(loginSource, /DEFAULT_LOGIN_MODE: Mode = "password"/, "login should default to email/password");
  assert.ok(
    loginSource.indexOf("Email Password") < loginSource.indexOf("Magic Code"),
    "email/password tab should appear before magic code"
  );
  assert.ok(
    loginSource.indexOf("Set or Reset Password") < loginSource.indexOf("Magic Code"),
    "magic code tab should be the last login option"
  );
});

test("global styles include branded splash background treatment", () => {
  assert.match(globalStyles, /\.branded-splash/);
  assert.match(globalStyles, /backdrop-filter: blur\(12px\)/);
});
