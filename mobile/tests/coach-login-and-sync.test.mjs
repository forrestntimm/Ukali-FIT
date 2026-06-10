import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const loginScreenPath = path.resolve(
  "/Users/forresttimm/Documents/Ukali sign in app/mobile/src/screens/LoginScreen.tsx"
);
const adminClassesPath = path.resolve(
  "/Users/forresttimm/Documents/Ukali sign in app/mobile/src/screens/AdminClassesManageScreen.tsx"
);
const authContextPath = path.resolve(
  "/Users/forresttimm/Documents/Ukali sign in app/mobile/src/context/AuthContext.tsx"
);
const athleteRootPath = path.resolve(
  "/Users/forresttimm/Documents/Ukali sign in app/mobile/src/app/AthleteRoot.tsx"
);
const coachRootPath = path.resolve(
  "/Users/forresttimm/Documents/Ukali sign in app/mobile/src/app/CoachRoot.tsx"
);
const appRootPath = path.resolve(
  "/Users/forresttimm/Documents/Ukali sign in app/mobile/App.tsx"
);
const pushNotificationsPath = path.resolve(
  "/Users/forresttimm/Documents/Ukali sign in app/mobile/src/lib/pushNotifications.ts"
);

test("coach login screen does not hide verification-code mode", () => {
  const source = fs.readFileSync(loginScreenPath, "utf8");

  assert.doesNotMatch(
    source,
    /const \[mode, setMode\] = useState<"otp" \| "password">\(IS_COACH_APP \? "password" : "otp"\)/,
    "Coach app should not force password-only login mode"
  );
  assert.doesNotMatch(
    source,
    /!IS_COACH_APP \? \(\s*<View style=\{styles\.modeRow\}>/s,
    "Coach app should not hide the OTP/password mode selector"
  );
});

test("admin classes screen does not store coaching schedule locally", () => {
  const source = fs.readFileSync(adminClassesPath, "utf8");

  assert.doesNotMatch(source, /expo-secure-store/, "Admin classes screen should not rely on device-local storage");
  assert.doesNotMatch(source, /COACH_SCHEDULE_KEY/, "Admin classes screen should not persist a local-only coaching schedule");
});

test("auth context ignores non-auth deep links from the Expo development client", () => {
  const source = fs.readFileSync(authContextPath, "utf8");

  assert.match(
    source,
    /includes\("auth\/callback"\)/,
    "Auth deep-link handling should explicitly gate on the auth callback path"
  );
});

test("startup push registration failures are contained for athlete and coach apps", () => {
  const athleteSource = fs.readFileSync(athleteRootPath, "utf8");
  const coachSource = fs.readFileSync(coachRootPath, "utf8");

  for (const [label, source] of [
    ["athlete", athleteSource],
    ["coach", coachSource]
  ]) {
    assert.match(
      source,
      /Device\.osName === "macOS"/,
      `${label} startup push flow should skip auto-registration on macOS`
    );
    assert.match(
      source,
      /try \{[\s\S]*syncRegisteredPushToken\(\)/,
      `${label} startup push flow should guard shared push registration`
    );
    assert.match(
      source,
      /catch \(error\)[\s\S]*console\.error\(/,
      `${label} startup push flow should catch and log startup notification failures instead of crashing`
    );
  }
});

test("app root provides safe-area context for screens that use useSafeAreaInsets", () => {
  const source = fs.readFileSync(appRootPath, "utf8");

  assert.match(
    source,
    /SafeAreaProvider/,
    "App.tsx should wrap the app in SafeAreaProvider because multiple startup screens call useSafeAreaInsets()"
  );
});

test("push helper supports syncing already-granted notification permissions to the backend", () => {
  const source = fs.readFileSync(pushNotificationsPath, "utf8");

  assert.match(source, /export async function syncRegisteredPushToken/, "push helper should expose a shared sync function");
  assert.match(source, /Notifications\.getPermissionsAsync\(\)/, "shared push sync should check current permissions");
  assert.match(source, /api\.post\("\/devices\/register"/, "shared push sync should register the device token with the backend");
});
