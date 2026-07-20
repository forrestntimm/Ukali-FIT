import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const mobileRoot = path.resolve(packageRoot);
const easConfigPath = path.join(mobileRoot, "eas.json");
const appConfigPath = path.join(mobileRoot, "app.config.ts");
const packageJsonPath = path.join(mobileRoot, "package.json");
const appPath = path.join(mobileRoot, "App.tsx");
const pushHelperPath = path.join(mobileRoot, "src", "lib", "pushNotifications.ts");
const easIgnorePath = path.join(mobileRoot, ".easignore");
const expoDevicePatchPath = path.join(mobileRoot, "patches", "expo-device+5.9.4.patch");
const reactNativePatchPath = path.join(mobileRoot, "patches", "react-native+0.73.6.patch");
const runtimeConfigPath = path.join(mobileRoot, "src", "config", "runtimeConfig.ts");
const supabaseLibPath = path.join(mobileRoot, "src", "lib", "supabase.ts");
const authContextPath = path.join(mobileRoot, "src", "context", "AuthContext.tsx");
const apiClientPath = path.join(mobileRoot, "src", "api", "client.ts");
const sessionGuardPath = path.join(mobileRoot, "src", "lib", "sessionGuard.ts");
const biometricCredentialsPath = path.join(mobileRoot, "src", "lib", "biometricCredentials.ts");
const appCrashHandlerPath = path.join(mobileRoot, "src", "lib", "appCrashHandler.ts");
const appErrorBoundaryPath = path.join(mobileRoot, "src", "components", "AppErrorBoundary.tsx");
const appLoadingScreenPath = path.join(mobileRoot, "src", "components", "AppLoadingScreen.tsx");
const adminDashboardPath = path.join(mobileRoot, "src", "screens", "AdminDashboardScreen.tsx");
const adminWodManagePath = path.join(mobileRoot, "src", "screens", "AdminWodManageScreen.tsx");
const adminMembersPath = path.join(mobileRoot, "src", "screens", "AdminMembersScreen.tsx");
const adminPaymentsManagePath = path.join(mobileRoot, "src", "screens", "AdminPaymentsManageScreen.tsx");
const adminScanPath = path.join(mobileRoot, "src", "screens", "AdminScanScreen.tsx");
const timezoneUtilsPath = path.join(mobileRoot, "src", "utils", "timezone.ts");
const loginScreenPath = path.join(mobileRoot, "src", "screens", "LoginScreen.tsx");
const athleteRootPath = path.join(mobileRoot, "src", "app", "AthleteRoot.tsx");
const coachRootPath = path.join(mobileRoot, "src", "app", "CoachRoot.tsx");
const staleFocusRefreshPath = path.join(mobileRoot, "src", "hooks", "useStaleFocusRefresh.ts");
const screenCachePath = path.join(mobileRoot, "src", "lib", "screenCache.ts");
const classesScreenPath = path.join(mobileRoot, "src", "screens", "ClassesScreen.tsx");
const adminClassesManagePath = path.join(mobileRoot, "src", "screens", "AdminClassesManageScreen.tsx");
const paymentsScreenPath = path.join(mobileRoot, "src", "screens", "PaymentsScreen.tsx");
const checkInQrHelperPath = path.join(mobileRoot, "src", "lib", "checkInQr.ts");
const athleteIconPath = path.join(mobileRoot, "assets", "icons", "athlete-icon.png");
const coachIconPath = path.join(mobileRoot, "assets", "icons", "coach-icon.png");
const athleteAdaptiveIconPath = path.join(mobileRoot, "assets", "icons", "athlete-adaptive-icon.png");
const coachAdaptiveIconPath = path.join(mobileRoot, "assets", "icons", "coach-adaptive-icon.png");
const runVariantScriptPath = path.join(mobileRoot, "scripts", "run-variant.sh");

test("EAS build profiles exist for athlete and coach App Store builds", () => {
  assert.ok(fs.existsSync(easConfigPath), "mobile/eas.json should exist");

  const easConfig = JSON.parse(fs.readFileSync(easConfigPath, "utf8"));

  assert.ok(easConfig.build?.["athlete-production"], "eas.json should define athlete-production");
  assert.ok(easConfig.build?.["coach-production"], "eas.json should define coach-production");
  assert.equal(easConfig.build["athlete-production"].distribution, "store");
  assert.equal(easConfig.build["coach-production"].distribution, "store");
  assert.equal(
    easConfig.build["athlete-production"].environment,
    "production",
    "athlete-production should explicitly use the EAS production environment"
  );
  assert.equal(
    easConfig.build["coach-production"].environment,
    "production",
    "coach-production should explicitly use the EAS production environment"
  );
  assert.equal(
    easConfig.build["athlete-production"]?.ios?.image,
    "macos-sequoia-15.6-xcode-16.4",
    "athlete-production should build with Xcode 16.4 / iOS 18 SDK"
  );
  assert.equal(
    easConfig.build["coach-production"]?.ios?.image,
    "macos-sequoia-15.6-xcode-16.4",
    "coach-production should build with Xcode 16.4 / iOS 18 SDK"
  );
});

test("preview profiles explicitly use the EAS preview environment", () => {
  const easConfig = JSON.parse(fs.readFileSync(easConfigPath, "utf8"));

  assert.equal(
    easConfig.build["athlete-preview"].environment,
    "preview",
    "athlete-preview should explicitly use the EAS preview environment"
  );
  assert.equal(
    easConfig.build["coach-preview"].environment,
    "preview",
    "coach-preview should explicitly use the EAS preview environment"
  );
});

test("app config includes App Store permission and versioning settings", () => {
  const source = fs.readFileSync(appConfigPath, "utf8");

  assert.match(source, /expo-image-picker/, "app.config.ts should configure expo-image-picker permissions");
  assert.match(source, /expo-notifications/, "app.config.ts should configure expo-notifications");
  assert.match(source, /expo-secure-store/, "app.config.ts should configure expo-secure-store for Face ID protected keychain access");
  assert.match(source, /faceIDPermission/, "app.config.ts should provide a Face ID usage message for biometric login");
  assert.match(source, /com\.forresttimm\.ukalifit/, "app.config.ts should use the athlete bundle ID registered in Apple");
  assert.match(source, /com\.forresttimm\.ukaliadmin/, "app.config.ts should use the coach bundle ID registered in Apple");
  assert.match(source, /buildNumber:/, "app.config.ts should set an iOS build number");
  assert.match(source, /versionCode:/, "app.config.ts should set an Android versionCode");
  assert.match(source, /usesNonExemptEncryption:\s*false/, "app.config.ts should declare non-exempt encryption status");
  assert.match(
    source,
    /staticConfig\.ios\?\.buildNumber/,
    "app.config.ts should inherit the current iOS build number from app.json so EAS auto-increment can advance past the previous release"
  );
  assert.match(
    source,
    /const appIconPath = isCoach \? "\.\/assets\/icons\/coach-icon\.png" : "\.\/assets\/icons\/athlete-icon\.png";/,
    "app.config.ts should define variant-specific app icon paths for coach and athlete"
  );
  assert.match(
    source,
    /icon:\s*appIconPath/,
    "app.config.ts should use the computed variant-specific app icon path"
  );
  assert.match(
    source,
    /const adaptiveIconPath = isCoach \? "\.\/assets\/icons\/coach-adaptive-icon\.png" : "\.\/assets\/icons\/athlete-adaptive-icon\.png";/,
    "app.config.ts should define variant-specific adaptive icon paths for coach and athlete"
  );
  assert.match(
    source,
    /foregroundImage:\s*adaptiveIconPath/,
    "app.config.ts should use the computed variant-specific Android adaptive icon path"
  );
});

test("shared mobile surfaces keep cards readable with stronger opacity", () => {
  const themeSource = fs.readFileSync(path.join(mobileRoot, "src", "theme.ts"), "utf8");

  assert.match(
    themeSource,
    /surfaceTranslucent:\s*"rgba\(22,\s*27,\s*34,\s*0\.84\)"/,
    "shared card surfaces should be a little more opaque so boxes feel clearer over the wallpaper background"
  );
  assert.match(
    themeSource,
    /surfaceElevatedTranslucent:\s*"rgba\(31,\s*38,\s*48,\s*0\.84\)"/,
    "elevated card surfaces should also be more opaque so both apps stay consistent"
  );
  assert.match(
    themeSource,
    /accentMutedTranslucent:\s*"rgba\(34,\s*52,\s*73,\s*0\.82\)"/,
    "accent-muted translucent boxes should keep the same less-transparent treatment"
  );
});



test("admin app uses more opaque card surfaces than the athlete app", () => {
  const themeSource = fs.readFileSync(path.join(mobileRoot, "src", "theme.ts"), "utf8");
  const adminDashboardSource = fs.readFileSync(adminDashboardPath, "utf8");
  const adminMembersSource = fs.readFileSync(path.join(mobileRoot, "src", "screens", "AdminMembersScreen.tsx"), "utf8");
  const adminClassesSource = fs.readFileSync(adminClassesManagePath, "utf8");
  const adminScanSource = fs.readFileSync(adminScanPath, "utf8");

  assert.match(
    themeSource,
    /adminSurfaceTranslucent:\s*"rgba\(22,\s*27,\s*34,\s*0\.88\)"/,
    "theme should define a more opaque admin surface color so the admin app boxes read more solidly"
  );
  assert.match(
    themeSource,
    /adminSurfaceElevatedTranslucent:\s*"rgba\(31,\s*38,\s*48,\s*0\.88\)"/,
    "theme should define a more opaque elevated admin surface color"
  );
  assert.match(
    themeSource,
    /adminAccentMutedTranslucent:\s*"rgba\(34,\s*52,\s*73,\s*0\.87\)"/,
    "theme should define a more opaque admin accent surface color"
  );
  assert.match(adminDashboardSource, /theme\.colors\.adminSurfaceTranslucent/, "admin dashboard should use the admin-specific card surface");
  assert.match(adminMembersSource, /theme\.colors\.adminSurfaceTranslucent/, "admin members screen should use the admin-specific card surface");
  assert.match(adminClassesSource, /theme\.colors\.adminSurfaceTranslucent/, "admin classes screen should use the admin-specific card surface");
  assert.match(adminScanSource, /theme\.colors\.adminSurfaceTranslucent/, "admin scan screen should use the admin-specific card surface");
});

test("variant-specific icon assets exist for athlete and coach", () => {
  assert.ok(fs.existsSync(athleteIconPath), "athlete icon asset should exist");
  assert.ok(fs.existsSync(coachIconPath), "coach icon asset should exist");
  assert.ok(fs.existsSync(athleteAdaptiveIconPath), "athlete adaptive icon asset should exist");
  assert.ok(fs.existsSync(coachAdaptiveIconPath), "coach adaptive icon asset should exist");
});

test("tab screens mount up front for instant switches but only fetch when focused", () => {
  const athleteRootSource = fs.readFileSync(athleteRootPath, "utf8");
  const coachRootSource = fs.readFileSync(coachRootPath, "utf8");
  const staleFocusRefreshSource = fs.readFileSync(staleFocusRefreshPath, "utf8");

  // Eager mounting is render-only: screens paint from warm caches and their
  // network loads still wait for focus, so cold start does not fan out fetches.
  assert.match(
    athleteRootSource,
    /lazy:\s*false/,
    "athlete tabs should pre-mount so switching tabs never pays a first-tap mount penalty"
  );
  assert.match(
    coachRootSource,
    /lazy:\s*false/,
    "coach tabs should pre-mount so switching tabs never pays a first-tap mount penalty"
  );
  assert.doesNotMatch(
    staleFocusRefreshSource,
    /useEffect\(\(\)\s*=>\s*{\s*void run\(\{\s*force:\s*true\s*}\);\s*}\s*,\s*\[run\]\s*\)/,
    "stale-focus refresh should wait for screen focus instead of force-loading every mounted screen on app launch"
  );
});

test("class schedule screens seed stale-refresh from cache so reopen stays fast", () => {
  const staleFocusRefreshSource = fs.readFileSync(staleFocusRefreshPath, "utf8");
  const classesScreenSource = fs.readFileSync(classesScreenPath, "utf8");
  const adminClassesScreenSource = fs.readFileSync(adminClassesManagePath, "utf8");
  const coachRootSource = fs.readFileSync(coachRootPath, "utf8");
  const athleteRootSource = fs.readFileSync(athleteRootPath, "utf8");
  const screenCacheSource = fs.readFileSync(screenCachePath, "utf8");

  assert.match(
    staleFocusRefreshSource,
    /seedLoadedAt/,
    "stale focus refresh should let screens seed a cached last-loaded timestamp"
  );
  assert.match(
    classesScreenSource,
    /seedLoadedAt\(cached\.savedAt\)/,
    "athlete classes screen should seed refresh freshness from cached schedule data"
  );
  assert.match(
    adminClassesScreenSource,
    /seedLoadedAt\(cached\.savedAt\)/,
    "admin classes screen should seed refresh freshness from cached schedule data"
  );
  assert.match(
    adminClassesScreenSource,
    /summary:\s*"true"/,
    "admin classes screen should request the lightweight summary payload instead of loading full signup detail"
  );
  assert.match(
    adminClassesScreenSource,
    /limit:\s*"20"/,
    "admin classes screen should cap the classes payload so the coach mobile tab does not load an unbounded schedule list"
  );
  assert.match(
    adminClassesScreenSource,
    /reservationCount/,
    "admin classes screen should render reservation counts from the summary payload"
  );
  assert.match(
    adminClassesScreenSource,
    /checkedInCount/,
    "admin classes screen should render checked-in counts from the summary payload"
  );
  assert.match(
    classesScreenSource,
    /5 \* 60 \* 1000/,
    "athlete classes screen should use a longer freshness window so reopening the app does not immediately refetch the schedule"
  );
  assert.match(
    adminClassesScreenSource,
    /5 \* 60 \* 1000/,
    "admin classes screen should use a longer freshness window so reopening the app does not immediately refetch the schedule"
  );
  assert.match(
    adminClassesScreenSource,
    /peekScreenCache<.*>\("admin-classes"\)/s,
    "admin classes screen should synchronously seed itself from the in-memory cache so the tab can paint immediately"
  );
  assert.match(
    adminClassesScreenSource,
    /setLoading\(\(current\) => current \|\| classes\.length === 0\)/,
    "admin classes screen should keep the empty-state shell visible while background sync runs instead of blocking first paint behind a spinner"
  );
  assert.match(
    screenCacheSource,
    /const memoryCache = new Map<string, string>\(\)/,
    "screen cache should keep a process-local memory mirror so recently prefetched screens can render instantly"
  );
  assert.match(
    screenCacheSource,
    /export function peekScreenCache</,
    "screen cache should expose a synchronous peek helper for instant first paint"
  );
  assert.match(
    coachRootSource,
    /writeScreenCache\("admin-classes"/,
    "coach app root should prefetch and warm the admin classes cache before the coach opens the Classes tab"
  );
  assert.match(
    athleteRootSource,
    /writeScreenCache\("classes"/,
    "athlete app root should prefetch and warm the athlete classes cache before the member opens the Classes tab"
  );
  assert.match(
    athleteRootSource,
    /api\.get\("\/classes"\)/,
    "athlete app root should warm the classes cache with the same schedule payload used by the Classes tab"
  );
  assert.match(
    coachRootSource,
    /api\.get\("\/classes",\s*{\s*params:\s*{\s*mine:\s*"true",\s*summary:\s*"true",\s*limit:\s*"20"/s,
    "coach app root should prefetch the same lightweight limited classes summary payload used by the Classes tab"
  );
});

test("mobile tabs keep opened screens warm and use cache-first refresh behavior across non-class tabs", () => {
  const athleteRootSource = fs.readFileSync(athleteRootPath, "utf8");
  const coachRootSource = fs.readFileSync(coachRootPath, "utf8");
  const communityScreenSource = fs.readFileSync(path.join(mobileRoot, "src", "screens", "CommunityScreen.tsx"), "utf8");
  const profileScreenSource = fs.readFileSync(path.join(mobileRoot, "src", "screens", "ProfileScreen.tsx"), "utf8");
  const adminMembersSource = fs.readFileSync(adminMembersPath, "utf8");
  const adminPaymentsSource = fs.readFileSync(adminPaymentsManagePath, "utf8");
  const adminScanSource = fs.readFileSync(adminScanPath, "utf8");

  assert.match(
    athleteRootSource,
    /AthleteTabs\.Navigator[\s\S]*detachInactiveScreens=\{false\}/s,
    "athlete tabs should keep opened tab screens attached so switching between them stays instant after first paint"
  );
  assert.match(
    coachRootSource,
    /CoachTabs\.Navigator[\s\S]*detachInactiveScreens=\{false\}/s,
    "coach tabs should keep opened tab screens attached so switching between them stays instant after first paint"
  );
  assert.match(
    communityScreenSource,
    /peekScreenCache<.*>\("announcements"\)/s,
    "announcements tab should synchronously seed from the in-memory cache before any async storage or network work"
  );
  assert.match(
    communityScreenSource,
    /seedLoadedAt\(cached\.savedAt\)/,
    "announcements tab should seed stale-refresh freshness from the cached timestamp"
  );
  assert.match(
    communityScreenSource,
    /5 \* 60 \* 1000/,
    "announcements tab should use a longer freshness window so switching back to it does not immediately refetch"
  );
  assert.match(
    athleteRootSource,
    /writeScreenCache\("announcements"/,
    "athlete root should warm the announcements cache before the member opens that tab for the first time"
  );
  assert.match(
    profileScreenSource,
    /useStaleFocusRefresh\(/,
    "profile tab should use the stale-focus refresh helper instead of always doing heavy focus work immediately"
  );
  assert.match(
    profileScreenSource,
    /seedLoadedAt\(cached\.savedAt\)/,
    "profile tab should seed stale-refresh freshness from its cached coach/admin profile payload"
  );
  assert.match(
    profileScreenSource,
    /5 \* 60 \* 1000/,
    "profile tab should use a longer freshness window so switching back to it stays warm"
  );
  assert.match(
    adminMembersSource,
    /5 \* 60 \* 1000/,
    "admin members tab should use a longer freshness window so switching back to it does not immediately refetch"
  );
  assert.match(
    adminPaymentsSource,
    /useStaleFocusRefresh\(/,
    "admin payments manager should use stale-focus refresh instead of reloading members and plans on every focus"
  );
  assert.match(
    adminPaymentsSource,
    /seedLoadedAt\(cached\.savedAt\)/,
    "admin payments manager should seed stale-refresh freshness from its cached payment options"
  );
  assert.match(
    adminPaymentsSource,
    /5 \* 60 \* 1000/,
    "admin payments manager should use a longer freshness window so switching back to it stays warm"
  );
  assert.doesNotMatch(
    adminPaymentsSource,
    /useFocusEffect/,
    "admin payments manager should not keep a custom every-focus reload path for payment options"
  );
  assert.match(
    adminScanSource,
    /useStaleFocusRefresh\(/,
    "admin scan tab should use a stale-focus refresh path for class-shell loading instead of reloading the shell on every focus"
  );
  assert.match(
    adminScanSource,
    /seedLoadedAt\(cached\.savedAt\)/,
    "admin scan tab should seed stale-refresh freshness from the cached check-in shell payload"
  );
  assert.match(
    adminScanSource,
    /savedAt:\s*Date\.now\(\)/,
    "admin scan tab should persist a savedAt timestamp so the shell can stay warm between tab switches"
  );
});

test("coach classes flow uses coaching schedule wording and expands selected class details in place", () => {
  const adminDashboardSource = fs.readFileSync(adminDashboardPath, "utf8");
  const adminClassesScreenSource = fs.readFileSync(adminClassesManagePath, "utf8");

  assert.match(
    adminDashboardSource,
    /<Text style=\{styles\.cardTitle\}>Your Coaching Schedule<\/Text>/,
    "admin dashboard should label the selected coaching focus card as Your Coaching Schedule"
  );
  assert.match(
    adminDashboardSource,
    /klass\.coachAssignmentRole === "SECONDARY" \? "Secondary Coach" : "Primary Coach"/,
    "admin dashboard should label each coaching schedule chip as a primary or secondary assignment"
  );
  assert.doesNotMatch(
    adminDashboardSource,
    /Select Class You Are Coaching/,
    "admin dashboard should no longer use the older Select Class You Are Coaching label"
  );
  assert.match(
    adminClassesScreenSource,
    /<Text style=\{styles\.cardTitle\}>Coaching Schedule<\/Text>/,
    "classes tab should present the assigned classes list as the coach's coaching schedule"
  );
  assert.doesNotMatch(
    adminClassesScreenSource,
    /Your coaching schedule is synced from the admin website and backend\./,
    "classes tab should not show the old helper copy under the page title"
  );
  assert.doesNotMatch(
    adminClassesScreenSource,
    /Schedule updates happen in the admin website Scheduling tab and appear here automatically\./,
    "classes tab should not show the old helper copy inside the coaching schedule card"
  );
  assert.match(
    adminClassesScreenSource,
    /<Text style=\{styles\.subText\}>No classes are assigned to you yet\.<\/Text>/,
    "classes tab should keep the no classes assigned empty-state message"
  );
  assert.doesNotMatch(
    adminClassesScreenSource,
    /Assigned Classes/,
    "classes tab should no longer use the older Assigned Classes wording"
  );
  assert.match(
    adminClassesScreenSource,
    /const handleOpenClass = useCallback\(async \(classId: string\) => \{[\s\S]*setExpandedClassId\(classId\)/s,
    "tapping a coaching schedule item should expand that class inside the classes tab"
  );
  assert.doesNotMatch(
    adminClassesScreenSource,
    /navigation\.navigate\("Dashboard",\s*\{\s*classId\s*}\)/,
    "classes tab should not kick the coach back to the dashboard when opening a class"
  );
  assert.match(
    adminClassesScreenSource,
    /api\.get\(`\/classes\/\$\{classId\}\/workout`\)/,
    "classes tab should load the workout for the expanded coaching class"
  );
  assert.match(
    adminClassesScreenSource,
    /expandedClassId === item\.id/,
    "classes tab should render an expanded state for the selected coaching class"
  );
  assert.match(
    adminClassesScreenSource,
    /Workout Of The Day/,
    "classes tab should show the workout heading inside the expanded class details"
  );
  assert.match(
    adminDashboardSource,
    /api\.get\("\/workouts\/today"\)/,
    "admin dashboard should keep its workout card tied to the daily workout feed"
  );
  assert.doesNotMatch(
    adminDashboardSource,
    /route\.params\?\.classId/,
    "admin dashboard should no longer depend on a classes-tab navigation param for class expansion"
  );
});

test("coach mobile admin flows use lightweight classes and athlete option payloads", () => {
  const adminDashboardSource = fs.readFileSync(adminDashboardPath, "utf8");
  const adminPaymentsSource = fs.readFileSync(adminPaymentsManagePath, "utf8");
  const adminScanSource = fs.readFileSync(adminScanPath, "utf8");
  const adminMembersSource = fs.readFileSync(adminMembersPath, "utf8");
  const coachRootSource = fs.readFileSync(coachRootPath, "utf8");
  const paymentsScreenSource = fs.readFileSync(paymentsScreenPath, "utf8");

  assert.match(
    adminDashboardSource,
    /api\.get\("\/classes",\s*{\s*params:\s*{\s*mine:\s*"true",\s*summary:\s*"true",\s*limit:\s*"20"/s,
    "admin dashboard should reuse the lightweight assigned-classes summary payload"
  );
  assert.doesNotMatch(
    adminDashboardSource,
    /api\.get\("\/classes",\s*{\s*params:\s*{\s*mine:\s*"true"\s*}\s*}\)/,
    "admin dashboard should not fetch the heavier classes payload for the coach tab shell"
  );
  assert.match(
    adminPaymentsSource,
    /api\.get\("\/users\/member-options"\)/,
    "admin payments manager should fetch lightweight athlete options instead of the full users index"
  );
  assert.match(
    adminMembersSource,
    /api\.get\("\/users\/member-options"\)/,
    "admin members screen should also use the lightweight athlete options payload"
  );
  assert.doesNotMatch(
    adminMembersSource,
    /api\.get\("\/users"\)/,
    "admin members screen should not fetch the heavy full users route"
  );
  assert.doesNotMatch(
    adminPaymentsSource,
    /api\.get\("\/users"\)/,
    "admin payments manager should not fetch the heavy users index for athlete selection"
  );
  assert.match(
    adminScanSource,
    /api\.get\("\/classes",\s*{\s*params:\s*{\s*mine:\s*"true",\s*summary:\s*"true",\s*limit:\s*"20"/s,
    "admin scan should use the lightweight summary classes payload before loading the selected roster"
  );
  assert.match(
    adminDashboardSource,
    /peekScreenCache<.*>\("admin-dashboard"\)/s,
    "admin dashboard should synchronously paint from the memory cache when available"
  );
  assert.match(
    adminDashboardSource,
    /api\.get\("\/classes",\s*{\s*params:\s*{\s*summary:\s*"true",\s*limit:\s*"5"/s,
    "admin dashboard should request a lightweight gym schedule summary when the coach has no assigned classes"
  );
  assert.match(
    adminDashboardSource,
    /<Text style=\{styles\.cardTitle\}>Gym Schedule<\/Text>/,
    "admin dashboard should show a Gym Schedule fallback card when the coach has no assigned classes"
  );
  assert.match(
    adminDashboardSource,
    /const \[gymScheduleExpanded,\s*setGymScheduleExpanded\] = useState\(false\)/,
    "admin dashboard gym schedule should start collapsed behind an explicit expand state"
  );
  assert.match(
    adminDashboardSource,
    /onPress=\{\(\) => setGymScheduleExpanded\(\(current\) => !current\)\}/,
    "admin dashboard gym schedule header should toggle expanded and collapsed states"
  );
  assert.match(
    adminDashboardSource,
    /gymScheduleExpanded \? "Collapse" : "Expand"/,
    "admin dashboard gym schedule toggle should clearly show whether it will expand or collapse"
  );
  assert.match(
    adminDashboardSource,
    /gymScheduleExpanded \? gymSchedule\.map/,
    "admin dashboard should only render gym schedule rows when the schedule is expanded"
  );
  assert.doesNotMatch(
    adminDashboardSource,
    /<Text style=\{styles\.cardTitle\}>No Assigned Classes<\/Text>/,
    "admin dashboard should no longer show the old No Assigned Classes fallback title"
  );
  assert.match(
    adminDashboardSource,
    /useStaleFocusRefresh\(/,
    "admin dashboard should refresh from a scoped stale-focus hook instead of always blocking first paint"
  );
  assert.match(
    adminMembersSource,
    /peekScreenCache/,
    "admin members screen should synchronously paint from cache when available"
  );
  assert.match(
    adminPaymentsSource,
    /peekScreenCache/,
    "admin payments manager should synchronously paint from cache when available"
  );
  assert.match(
    adminScanSource,
    /peekScreenCache/,
    "admin scan should synchronously paint from cache when available"
  );
  assert.match(
    coachRootSource,
    /writeScreenCache\("admin-members"/,
    "coach root should warm the members cache before the Members tab is opened"
  );
  assert.match(
    coachRootSource,
    /writeScreenCache\("admin-payments"/,
    "coach root should warm the payments cache before the Payments manager is opened"
  );
  assert.match(
    coachRootSource,
    /writeScreenCache\("admin-scan"/,
    "coach root should warm the check-in cache before the Check-In tab is opened"
  );
  assert.match(
    paymentsScreenSource,
    /peekScreenCache<.*>\("payments"\)/s,
    "athlete payments screen should synchronously paint from the memory cache when available"
  );
  assert.match(
    paymentsScreenSource,
    /useStaleFocusRefresh\(/,
    "athlete payments screen should reuse the stale-focus refresh path for background updates"
  );
  assert.doesNotMatch(
    paymentsScreenSource,
    /setLoading\(true\);\s*Promise\.all/s,
    "athlete payments screen should not blindly block first paint behind a full-screen loading spinner when warm cache exists"
  );
});

test("admin app keeps website-only management tools out of the mobile experience", () => {
  const adminDashboardSource = fs.readFileSync(adminDashboardPath, "utf8");
  const coachRootSource = fs.readFileSync(coachRootPath, "utf8");

  assert.doesNotMatch(
    adminDashboardSource,
    /Admin Tools/,
    "admin dashboard should not render the website-only Admin Tools card"
  );
  assert.doesNotMatch(
    adminDashboardSource,
    /navigation\.navigate\("WodManager"\)/,
    "admin dashboard should not expose website-only workout management from the app"
  );
  assert.doesNotMatch(
    adminDashboardSource,
    /navigation\.navigate\("AnnouncementsManager"\)/,
    "admin dashboard should not expose website-only announcements management from the app"
  );
  assert.doesNotMatch(
    adminDashboardSource,
    /navigation\.navigate\("PaymentsManager"\)/,
    "admin dashboard should not expose website-only payments management from the app"
  );
  assert.doesNotMatch(
    coachRootSource,
    /AdminPaymentsManageScreen|AdminAnnouncementsManageScreen|AdminWodManageScreen/,
    "coach root should not register website-only manager screens in the mobile app stack"
  );
  assert.doesNotMatch(
    coachRootSource,
    /PaymentsManager|AnnouncementsManager|WodManager/,
    "coach root should not keep website-only management routes in the mobile app stack"
  );
});

test("athlete QR rendering uses a stable app-specific payload while preserving the stored per-user code", () => {
  const dashboardSource = fs.readFileSync(path.join(mobileRoot, "src", "screens", "DashboardScreen.tsx"), "utf8");
  const checkInQrHelperSource = fs.readFileSync(checkInQrHelperPath, "utf8");

  assert.match(
    checkInQrHelperSource,
    /ukali-checkin:v1:/,
    "athlete QR payload helper should emit the stable Ukali QR prefix"
  );
  assert.match(
    dashboardSource,
    /buildCheckInQrPayload\(qrValue\)/,
    "athlete dashboard should build the QR image from the stable payload helper"
  );
  assert.match(
    dashboardSource,
    /Text selectable style={styles\.qrText}>{qrValue}<\/Text>/,
    "athlete dashboard should still display the persisted raw QR code value for manual backup entry"
  );
});

test("auth bootstrap preserves cached login state and exposes iPhone password autofill semantics", () => {
  const authContextSource = fs.readFileSync(authContextPath, "utf8");
  const loginScreenSource = fs.readFileSync(loginScreenPath, "utf8");
  const profileScreenSource = fs.readFileSync(path.join(mobileRoot, "src", "screens", "ProfileScreen.tsx"), "utf8");
  const biometricSource = fs.readFileSync(biometricCredentialsPath, "utf8");

  assert.match(
    authContextSource,
    /onAuthStateChange\(\(event: AuthChangeEvent, session\) => [\s\S]*if \(event === "SIGNED_OUT"\) \{/,
    "auth state changes should only clear the cached user for a real SIGNED_OUT event, not for transient null sessions during startup"
  );
  assert.match(
    loginScreenSource,
    /textContentType="username"/,
    "login email field should advertise username semantics so iPhone can offer saved-password autofill"
  );
  assert.match(
    loginScreenSource,
    /autoComplete="email"/,
    "login email field should advertise email autofill semantics"
  );
  assert.match(
    loginScreenSource,
    /textContentType="password"/,
    "login password field should advertise password semantics so iPhone can offer saved-password autofill"
  );
  assert.match(
    loginScreenSource,
    /autoComplete="password"/,
    "login password field should advertise password autofill semantics"
  );
  assert.match(
    profileScreenSource,
    /textContentType="newPassword"/,
    "password setup inputs should advertise new-password semantics so iPhone can offer to save the created password"
  );
  assert.match(
    authContextSource,
    /saveBiometricCredentials\(/,
    "password logins should save a biometric quick-login credential after successful authentication"
  );
  assert.match(
    authContextSource,
    /signInWithOtp\(\{\s*email:\s*normalized,\s*options:\s*\{\s*shouldCreateUser:\s*false\s*\}\s*\}\)/s,
    "mobile verification-code login should stay in a true OTP flow instead of generating a redirect-based first-time signup link"
  );
  assert.doesNotMatch(
    authContextSource,
    /sendMagicLink[\s\S]*emailRedirectTo:/,
    "mobile verification-code login should not attach an email redirect target that can bounce first-time admins into the website"
  );
  assert.match(
    authContextSource,
    /signInWithBiometrics:/,
    "auth context should expose a biometric sign-in action for Face ID relogin"
  );
  assert.match(
    biometricSource,
    /requireAuthentication:\s*true/,
    "biometric credentials should be stored behind platform biometric authentication"
  );
  assert.match(
    biometricSource,
    /WHEN_PASSCODE_SET_THIS_DEVICE_ONLY/,
    "biometric credentials should stay bound to the current device passcode/biometric set"
  );
  assert.match(
    loginScreenSource,
    /Use Face ID/,
    "login screen should expose a Face ID quick-login option when a saved biometric credential exists"
  );
  assert.match(
    authContextSource,
    /event === "INITIAL_SESSION" \|\| event === "TOKEN_REFRESHED"/,
    "auth listener should ignore initial-session and token-refresh events so app launch and login do not bootstrap twice"
  );
  assert.doesNotMatch(
    authContextSource,
    /if \(session\) \{\s*void bootstrap\(session\)/,
    "auth listener should not eagerly re-bootstrap every non-signout session event"
  );
});

test("profile screen uses an expandable PR card while keeping profile and password editing in the Edit menu", () => {
  const profileScreenSource = fs.readFileSync(path.join(mobileRoot, "src", "screens", "ProfileScreen.tsx"), "utf8");

  assert.match(
    profileScreenSource,
    /<Text style={styles\.editButtonLabel}>Edit<\/Text>/,
    "profile screen should expose an Edit button in the header area"
  );
  assert.match(
    profileScreenSource,
    /Athlete Profile/,
    "profile screen should keep an athlete profile editing entry in the edit menu"
  );
  assert.match(
    profileScreenSource,
    /Password Login/,
    "profile screen should expose a password login entry in the edit menu"
  );
  assert.match(
    profileScreenSource,
    /<Text style=\{styles\.cardTitle\}>PR<\/Text>/,
    "profile screen should replace the old password card with a collapsed PR card"
  );
  assert.match(
    profileScreenSource,
    /setIsPrExpanded\(\(prev\) => !prev\)/,
    "profile screen should let the user expand and collapse the PR card inline"
  );
  assert.match(
    profileScreenSource,
    /Deadlift/,
    "profile screen PR editor should include a Deadlift field"
  );
  assert.match(
    profileScreenSource,
    /Back Squat/,
    "profile screen PR editor should include a Back Squat field"
  );
  assert.match(
    profileScreenSource,
    /1 Mile Run/,
    "profile screen PR editor should include a 1 Mile Run field"
  );
  assert.match(
    profileScreenSource,
    /5km Run/,
    "profile screen PR editor should include a 5km Run field"
  );
  assert.doesNotMatch(
    profileScreenSource,
    /<Text style=\{styles\.cardTitle\}>Password Login<\/Text>/,
    "profile screen should no longer render the old Password Login summary card"
  );
  assert.match(
    profileScreenSource,
    /<Modal[\s\S]*visible={activeEditor !== null}/,
    "profile screen should present the editor as a focused modal instead of inline cards"
  );
  assert.match(
    profileScreenSource,
    /TextInput[\s\S]*placeholder=\"Name\"/s,
    "athlete profile editor should let the user edit their name"
  );
  assert.match(
    profileScreenSource,
    /TextInput[\s\S]*placeholder=\"Age\"/s,
    "athlete profile editor should keep age editable"
  );
  assert.match(
    profileScreenSource,
    /TextInput[\s\S]*placeholder=\"Your goals\"/s,
    "athlete profile editor should keep fitness goals editable"
  );
  assert.match(
    profileScreenSource,
    /Choose From Gallery/,
    "athlete profile editor should still support importing a photo from the library"
  );
  assert.doesNotMatch(
    profileScreenSource,
    /Workout Streak:/,
    "profile screen should remove workout streak copy from the athlete profile card"
  );
  assert.doesNotMatch(
    profileScreenSource,
    /Classes Attended:/,
    "profile screen should remove classes attended copy from the athlete profile card"
  );
});

test("api client uses an in-memory token fast path before falling back to secure session lookup", () => {
  const clientSource = fs.readFileSync(path.join(mobileRoot, "src", "api", "client.ts"), "utf8");

  assert.match(
    clientSource,
    /getCachedAccessToken\(\)/,
    "mobile API requests should try the in-memory access token first to avoid repeated secure-store session lookups"
  );
  assert.match(
    clientSource,
    /setCachedAccessToken\(accessToken\)/,
    "mobile API requests should repopulate the in-memory token cache when they do have to fall back to Supabase session lookup"
  );
  assert.match(
    clientSource,
    /status !== 401/,
    "mobile API client should detect unauthorized responses and avoid retrying unrelated failures"
  );
  assert.match(
    clientSource,
    /config\.__ukaliRetried = true/,
    "mobile API client should retry a protected request at most once after restoring the session token"
  );
  assert.match(
    clientSource,
    /return api\.request\(config\)/,
    "mobile API client should replay the original request after recovering a missing session token"
  );
  assert.match(
    clientSource,
    /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/,
    "mobile API client should resolve the device timezone for timezone-aware daily content"
  );
  assert.match(
    clientSource,
    /x-ukali-time-zone/i,
    "mobile API client should attach the resolved timezone on API requests"
  );
});

test("push registration resolves an Expo project id explicitly for store builds", () => {
  assert.ok(fs.existsSync(pushHelperPath), "push notification helper should exist");

  const source = fs.readFileSync(pushHelperPath, "utf8");
  assert.match(source, /getExpoPushTokenAsync\(\{\s*projectId\s*\}\)/, "push token registration should pass projectId explicitly");
});

test("mobile app clears icon badges on open and after push token sync", () => {
  const pushSource = fs.readFileSync(pushHelperPath, "utf8");
  const appSource = fs.readFileSync(appPath, "utf8");

  assert.match(pushSource, /Notifications\.setBadgeCountAsync\(0\)/, "push token sync should clear local icon badges");
  assert.match(appSource, /shouldSetBadge:\s*true/, "notification handler should allow badge updates");
  assert.match(appSource, /Notifications\.setBadgeCountAsync\(0\)/, "app startup should clear icon badges when the app opens");
});

const localBuildScriptPath = path.join(mobileRoot, "scripts", "build-local-ios.sh");
const ipaValidationScriptPath = path.join(mobileRoot, "scripts", "validate-ios-ipa.sh");

test("package scripts expose validated direct local iOS archive commands for athlete and coach", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.equal(
    pkg.scripts["prep:ios:athlete"],
    "bash scripts/run-variant.sh athlete prep-ios",
    "package.json should define a dedicated athlete iOS native prep step"
  );
  assert.equal(
    pkg.scripts["prep:ios:coach"],
    "bash scripts/run-variant.sh coach prep-ios",
    "package.json should define a dedicated coach iOS native prep step"
  );
  assert.ok(fs.existsSync(localBuildScriptPath), "direct local iOS build helper should exist");
  assert.ok(fs.existsSync(ipaValidationScriptPath), "IPA validation helper should exist");

  assert.equal(
    pkg.scripts["eas:build:local:ios:athlete"],
    "bash scripts/build-local-ios.sh athlete",
    "athlete local iOS builds should use the direct xcodebuild archive/export helper"
  );
  assert.equal(
    pkg.scripts["eas:build:local:ios:coach"],
    "bash scripts/build-local-ios.sh coach",
    "coach local iOS builds should use the direct xcodebuild archive/export helper"
  );
  assert.equal(
    pkg.scripts["eas:build:ios:athlete"],
    "npm run eas:build:local:ios:athlete",
    "athlete App Store build command should route to the local-only helper instead of cloud EAS"
  );
  assert.equal(
    pkg.scripts["eas:build:ios:coach"],
    "npm run eas:build:local:ios:coach",
    "coach App Store build command should route to the local-only helper instead of cloud EAS"
  );
  assert.match(
    pkg.scripts["eas:submit:ios:athlete"],
    /--platform ios --profile athlete-production --path "\$IPA_PATH" --non-interactive --no-wait/,
    "athlete submit command should require an explicit IPA path and stay non-interactive"
  );
  assert.match(
    pkg.scripts["eas:submit:ios:coach"],
    /--platform ios --profile coach-production --path "\$IPA_PATH" --non-interactive --no-wait/,
    "coach submit command should require an explicit IPA path and stay non-interactive"
  );
  assert.match(
    pkg.scripts["eas:submit:ios:athlete"],
    /IPA_PATH must be set to an absolute \.ipa path/,
    "athlete submit command should guard against missing or relative IPA paths"
  );
  assert.match(
    pkg.scripts["eas:submit:ios:coach"],
    /IPA_PATH must be set to an absolute \.ipa path/,
    "coach submit command should guard against missing or relative IPA paths"
  );

  const localBuildSource = fs.readFileSync(localBuildScriptPath, "utf8");
  assert.match(
    localBuildSource,
    /npx pod-install --non-interactive[\s\S]*bash scripts\/run-variant\.sh \"\$variant\" prep-ios/,
    "direct local build helper should reapply iOS prep after pod install so .xcode.env.updates survives to archive time"
  );
  assert.match(
    localBuildSource,
    /IOS_PROVISIONING_PROFILE_(SPECIFIER|UUID)|CODE_SIGN_STYLE=Manual/,
    "direct local build helper should support manual signing overrides for local imported App Store credentials"
  );
  assert.match(
    localBuildSource,
    /CFBundleIdentifier/,
    "direct local build helper should read the bundle identifier so export options can map the correct provisioning profile"
  );
  assert.match(
    localBuildSource,
    /PRODUCT_BUNDLE_IDENTIFIER/,
    "direct local build helper should resolve the real bundle identifier from Xcode build settings when Info.plist still uses the PRODUCT_BUNDLE_IDENTIFIER placeholder"
  );
  assert.match(
    localBuildSource,
    /Set :aps-environment production/,
    "direct local build helper should convert push entitlements to production for App Store exports"
  );
  assert.match(
    localBuildSource,
    /CODE_SIGN_ENTITLEMENTS=\"\$entitlements_override_path\"/,
    "direct local build helper should archive with the release-only entitlements override when manual signing is used"
  );
  assert.match(
    localBuildSource,
    /provisioningProfiles:\$bundle_identifier string \$export_profile_value/,
    "direct local build helper should generate export options that map the app bundle ID to the manual App Store provisioning profile"
  );
  assert.match(
    localBuildSource,
    /workspace_path=\"\$\{project_root\}\/ios\/\$\{project_name\}\.xcworkspace\"/,
    "direct local build helper should archive from the CocoaPods workspace so Expo native modules are included"
  );
  assert.doesNotMatch(
    localBuildSource,
    /\.xcodeproj\/project\.xcworkspace/,
    "direct local build helper must not archive from the nested project workspace because pods will be missing from the build graph"
  );

  assert.doesNotMatch(
    pkg.scripts["eas:build:local:ios:athlete"],
    /eas-cli build/,
    "athlete local iOS builds must not call eas-cli build because the exported IPA can miss the embedded JS bundle"
  );
  assert.doesNotMatch(
    pkg.scripts["eas:build:local:ios:coach"],
    /eas-cli build/,
    "coach local iOS builds must not call eas-cli build because the exported IPA can miss the embedded JS bundle"
  );
  assert.doesNotMatch(
    pkg.scripts["eas:build:ios:athlete"],
    /eas-cli build/,
    "athlete top-level build command must not fall back to a cloud build"
  );
  assert.doesNotMatch(
    pkg.scripts["eas:build:ios:coach"],
    /eas-cli build/,
    "coach top-level build command must not fall back to a cloud build"
  );
});

test("iOS variant prep protects embedded JS bundling for release archives", () => {
  assert.ok(fs.existsSync(runVariantScriptPath), "run-variant helper should exist");

  const source = fs.readFileSync(runVariantScriptPath, "utf8");

  assert.match(
    source,
    /local release archives\/TestFlight[\s\S]*always embed their JS bundle\./,
    "run-variant helper should document why release builds explicitly preserve embedded JS bundling"
  );
  assert.match(
    source,
    /if \[\[ -n \"\$\{CONFIGURATION:-\}\" && \"\$CONFIGURATION\" != \*Debug\* \]\]; then[\s\S]*unset SKIP_BUNDLING/,
    "run-variant helper should explicitly unset SKIP_BUNDLING for non-Debug archive builds"
  );
  assert.ok(
    source.includes("const brokenCommand ="),
    "run-variant helper should recognize the broken literal backslash-n bundle phase variant"
  );
  assert.ok(
    source.includes("const newCommand ="),
    "run-variant helper should define the corrected bundle phase command"
  );
  assert.ok(
    source.includes("source = source.split(brokenCommand).join(newCommand);"),
    "run-variant helper should actively repair previously generated broken bundle scripts"
  );
  assert.ok(
    source.includes("const originalSource = source;"),
    "run-variant helper should track the original pbxproj contents before attempting repairs"
  );
  assert.ok(
    source.includes("if (source !== originalSource) {"),
    "run-variant helper should write repaired bundle scripts back to disk whenever a replacement actually occurred"
  );
  assert.ok(
    source.includes(`find "\${project_root}/ios" -maxdepth 1 -type d -name '*.xcodeproj'`),
    "run-variant helper should verify the generated iOS project still exists before trusting the last-variant marker"
  );
  assert.match(
    source,
    /if \[\[ \"\$last_variant\" == \"\$variant\" && \"\$native_project_exists\" == true \]\]; then/,
    "run-variant helper should only skip prebuild when the last variant matches and the native project is actually present"
  );
});

test("EAS cloud builds ignore checked-in native directories so variant bundle IDs don't bleed across builds", () => {
  assert.ok(fs.existsSync(easIgnorePath), "mobile/.easignore should exist");

  const source = fs.readFileSync(easIgnorePath, "utf8");
  assert.match(source, /^ios$/m, ".easignore should ignore ios for cloud builds");
  assert.match(source, /^android$/m, ".easignore should ignore android for cloud builds");
});

test("expo-device is patched persistently for Xcode 16+ store builds", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.equal(
    pkg.scripts.postinstall,
    "patch-package",
    "package.json should run patch-package after install so EAS gets the expo-device fix"
  );
  assert.ok(fs.existsSync(expoDevicePatchPath), "expo-device patch should be committed");

  const patch = fs.readFileSync(expoDevicePatchPath, "utf8");
  assert.match(
    patch,
    /targetEnvironment\(simulator\)/,
    "expo-device patch should replace the deprecated TARGET_OS_SIMULATOR Swift check"
  );
});

test("local export options use the current App Store Connect export method", () => {
  const exportOptionsSource = fs.readFileSync(path.join(mobileRoot, "scripts", "ExportOptions-app-store.plist"), "utf8");
  assert.match(
    exportOptionsSource,
    /<string>app-store-connect<\/string>/,
    "export options should use the current app-store-connect export method"
  );
});

test("IPA validator enforces bundle integrity and filename version discipline", () => {
  const source = fs.readFileSync(ipaValidationScriptPath, "utf8");

  assert.match(
    source,
    /Info\.plist/,
    "IPA validator should inspect the embedded Info.plist instead of validating only file presence"
  );
  assert.match(
    source,
    /CFBundleShortVersionString/,
    "IPA validator should read the embedded marketing version"
  );
  assert.match(
    source,
    /CFBundleVersion/,
    "IPA validator should read the embedded build number"
  );
  assert.match(
    source,
    /basename "\$ipa_path"/,
    "IPA validator should compare the embedded version metadata to the stable IPA filename"
  );
  assert.match(
    source,
    /-build\$\{build_number\}-local\.ipa/,
    "IPA validator should require the stable IPA filename to carry the embedded build number"
  );
});

test("release docs and scripts stay aligned to the local-only validated workflow", () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const precheckSource = fs.readFileSync(path.join(mobileRoot, "APP_STORE_PRECHECKLIST.md"), "utf8");
  const releaseSource = fs.readFileSync(path.join(mobileRoot, "APP_STORE_RELEASE.md"), "utf8");

  assert.match(
    precheckSource,
    /npm run eas:build:local:ios:athlete/,
    "precheck checklist should instruct the athlete build through the local helper"
  );
  assert.match(
    precheckSource,
    /npm run eas:build:local:ios:coach/,
    "precheck checklist should instruct the coach build through the local helper"
  );
  assert.match(
    precheckSource,
    /bash scripts\/validate-ios-ipa\.sh/,
    "precheck checklist should require IPA validation before upload"
  );
  assert.match(
    precheckSource,
    /Transporter/,
    "precheck checklist should document the Transporter upload path explicitly"
  );
  assert.doesNotMatch(
    precheckSource,
    /npx eas-cli build --platform ios --profile/,
    "precheck checklist must not instruct cloud iOS builds"
  );

  assert.match(
    releaseSource,
    /npm run eas:build:local:ios:athlete/,
    "release guide should point athlete builds at the local helper"
  );
  assert.match(
    releaseSource,
    /npm run eas:build:local:ios:coach/,
    "release guide should point coach builds at the local helper"
  );
  assert.match(
    releaseSource,
    /bash scripts\/validate-ios-ipa\.sh/,
    "release guide should require explicit IPA validation"
  );
  assert.match(
    releaseSource,
    /IPA_PATH=/,
    "release guide should document the explicit IPA_PATH submit flow if EAS submit is used"
  );
  assert.doesNotMatch(
    releaseSource,
    /npx eas-cli build --platform ios --profile/,
    "release guide must not instruct cloud iOS builds"
  );

  assert.equal(
    pkg.scripts["eas:build:ios:athlete"],
    "npm run eas:build:local:ios:athlete",
    "package script and docs should agree on the athlete release build command"
  );
  assert.equal(
    pkg.scripts["eas:build:ios:coach"],
    "npm run eas:build:local:ios:coach",
    "package script and docs should agree on the coach release build command"
  );
});

test("react-native Hermes replacement script is patched for local paths with spaces", () => {
  assert.ok(fs.existsSync(reactNativePatchPath), "react-native patch should be committed");

  const patch = fs.readFileSync(reactNativePatchPath, "utf8");
  assert.match(
    patch,
    /execFileSync/,
    "react-native patch should switch the Hermes tar extraction to execFileSync"
  );
  assert.match(
    patch,
    /tar', \['-xf', tarballURLPath, '-C', finalLocation\]/,
    "react-native patch should pass the tarball path as a discrete argument so repo paths with spaces do not break local archives"
  );
});

test("runtime config explicitly validates required public release env vars", () => {
  assert.ok(fs.existsSync(runtimeConfigPath), "runtime config module should exist");

  const source = fs.readFileSync(runtimeConfigPath, "utf8");
  assert.match(source, /EXPO_PUBLIC_API_URL/, "runtime config should validate EXPO_PUBLIC_API_URL");
  assert.match(source, /EXPO_PUBLIC_SUPABASE_URL/, "runtime config should validate EXPO_PUBLIC_SUPABASE_URL");
  assert.match(source, /EXPO_PUBLIC_SUPABASE_ANON_KEY/, "runtime config should validate EXPO_PUBLIC_SUPABASE_ANON_KEY");
  assert.match(source, /RUNTIME_CONFIG_ERROR/, "runtime config should export a user-facing config error");
});

test("supabase bootstrap no longer throws at import time when release env vars are missing", () => {
  const source = fs.readFileSync(supabaseLibPath, "utf8");

  assert.doesNotMatch(
    source,
    /createClient\(supabaseUrl \|\| ""\s*,\s*supabaseAnonKey \|\| ""/,
    "supabase.ts should not instantiate Supabase with empty strings at module import time"
  );
  assert.match(
    source,
    /RUNTIME_CONFIG_ERROR/,
    "supabase.ts should respect the runtime config guard before constructing the real client"
  );
});

test("admin dashboard keeps the daily WOD stable while class detail hydration focuses on signups", () => {
  const source = fs.readFileSync(adminDashboardPath, "utf8");

  assert.match(
    source,
    /api\.get\("\/workouts\/today"\)/,
    "AdminDashboardScreen should keep its workout card grounded in the daily workout feed"
  );
  assert.doesNotMatch(
    source,
    /api\.get\(`\/classes\/\$\{classId\}\/workout`\)/,
    "AdminDashboardScreen should no longer swap its workout card to a class-specific workout when the coach changes class focus"
  );
  assert.match(
    source,
    /Promise\.allSettled\(\s*\[\s*api\.get\(`\/classes\/\$\{classId\}\/signups`\)/s,
    "AdminDashboardScreen should fail soft on selected-class signup hydration without tying the daily workout card to that request"
  );
  assert.match(
    source,
    /Could not load dashboard\./,
    "AdminDashboardScreen should still report a real dashboard failure when the primary class-list request fails"
  );
  assert.match(
    source,
    /Some class details could not be loaded\./,
    "AdminDashboardScreen should downgrade selected-class hydration failures to a scoped class-details warning"
  );
});

test("admin workout manager sends the entered calendar date without timezone conversion", () => {
  const source = fs.readFileSync(adminWodManagePath, "utf8");

  assert.match(
    source,
    /date:\s*normalizedDate/,
    "AdminWodManageScreen should send the raw YYYY-MM-DD string to the backend"
  );
  assert.doesNotMatch(
    source,
    /toISOString\(\)/,
    "AdminWodManageScreen should not shift workout dates through local-to-UTC ISO conversion"
  );
});

test("mobile auth startup guards against invalid refresh tokens", () => {
  assert.ok(fs.existsSync(sessionGuardPath), "session guard module should exist");

  const helperSource = fs.readFileSync(sessionGuardPath, "utf8");
  const authSource = fs.readFileSync(authContextPath, "utf8");
  const apiSource = fs.readFileSync(apiClientPath, "utf8");

  assert.match(
    helperSource,
    /Invalid Refresh Token|Refresh Token Not Found/,
    "session guard should explicitly recognize stale refresh-token errors from Supabase"
  );
  assert.match(
    fs.readFileSync(supabaseLibPath, "utf8"),
    /storageKey:\s*AUTH_STORAGE_KEY/,
    "supabase.ts should pin auth persistence to a versioned storage key so corrupted legacy sessions can be bypassed"
  );
  assert.match(
    authSource,
    /safeGetSession/,
    "AuthContext should use the guarded session helper during bootstrap and refresh"
  );
  assert.match(
    authSource,
    /safeClearSession/,
    "AuthContext should clear broken persisted sessions with the guarded cleanup helper"
  );
  assert.match(
    apiSource,
    /safeGetSession/,
    "the mobile API client should use the guarded session helper before attaching auth headers"
  );
  assert.doesNotMatch(
    helperSource,
    /export async function safeGetSession[\s\S]*throw error;/,
    "safeGetSession should fail closed and clear persisted auth state instead of rethrowing startup session errors"
  );
  assert.doesNotMatch(
    helperSource,
    /await client\.auth\.signOut\(\{ scope: "local" \}\);\s*\}\s*$/m,
    "session cleanup should swallow even local sign-out failures instead of letting startup recovery crash"
  );
});

test("app startup installs a global fatal-error handler and render boundary", () => {
  const appSource = fs.readFileSync(path.join(mobileRoot, "App.tsx"), "utf8");
  const crashHandlerSource = fs.readFileSync(appCrashHandlerPath, "utf8");
  const boundarySource = fs.readFileSync(appErrorBoundaryPath, "utf8");

  assert.match(
    appSource,
    /installGlobalErrorHandler\(\)/,
    "App.tsx should install the shared global JS error handler during startup"
  );
  assert.match(
    appSource,
    /subscribeToFatalError/,
    "App.tsx should subscribe to fatal JS errors so release builds can fall back to a stable screen"
  );
  assert.match(
    appSource,
    /<AppErrorBoundary[\s>]/,
    "App.tsx should wrap the main app tree in an error boundary"
  );
  assert.match(
    crashHandlerSource,
    /ErrorUtils/,
    "app crash handler should hook into React Native's global ErrorUtils handler"
  );
  assert.match(
    crashHandlerSource,
    /reportFatalError/,
    "app crash handler should publish captured fatal errors to the app"
  );
  assert.match(
    crashHandlerSource,
    /export function clearLatestFatalError/,
    "app crash handler should expose a way to clear a captured fatal error for bounded retry"
  );
  assert.match(
    boundarySource,
    /componentDidCatch/,
    "AppErrorBoundary should catch render-time React errors"
  );
  assert.match(
    boundarySource,
    /Try Again/,
    "AppErrorBoundary should offer a bounded retry action instead of trapping the app in a dead-end error screen"
  );
  assert.match(
    appSource,
    /clearLatestFatalError/,
    "App.tsx should clear the captured fatal error before retrying startup"
  );
  assert.match(
    appSource,
    /Try Again/,
    "App.tsx should offer a retry path on the fatal startup fallback screen"
  );
});

test("launch branding uses the same wallpaper background during native splash and auth loading", () => {
  const appConfigSource = fs.readFileSync(appConfigPath, "utf8");
  const appSource = fs.readFileSync(path.join(mobileRoot, "App.tsx"), "utf8");
  const athleteRootSource = fs.readFileSync(path.join(mobileRoot, "src", "app", "AthleteRoot.tsx"), "utf8");
  const coachRootSource = fs.readFileSync(path.join(mobileRoot, "src", "app", "CoachRoot.tsx"), "utf8");

  assert.ok(fs.existsSync(appLoadingScreenPath), "a shared branded loading screen should exist");
  assert.match(
    appConfigSource,
    /splash:\s*\{[\s\S]*image:\s*"\.\/assets\/wallpaper-logo\.png"/,
    "app.config.ts should use the wallpaper logo for the native splash image"
  );
  assert.match(
    appConfigSource,
    /backgroundColor:\s*"#0D1117"/,
    "app.config.ts splash should use the same background color as the in-app theme"
  );
  assert.match(appSource, /AppLoadingScreen/, "App.tsx should use the branded loading screen");
  assert.match(athleteRootSource, /if \(loading\) return <AppLoadingScreen/, "athlete root should show branded loading while auth restores");
  assert.match(coachRootSource, /if \(loading\) return <AppLoadingScreen/, "coach root should show branded loading while auth restores");
});

test("login screen keeps the auth card visually higher and more central", () => {
  const source = fs.readFileSync(loginScreenPath, "utf8");

  assert.match(source, /contentWrapper:/, "login screen should define a wrapper around the header and form card");
  assert.match(
    source,
    /transform:\s*\[\{\s*translateY:\s*-\d+/,
    "login screen wrapper should shift the login UI upward so it sits more centrally on screen"
  );
});

test("auth bootstrap preserves the signed-in session and cached user profile across transient startup failures", () => {
  const source = fs.readFileSync(authContextPath, "utf8");

  assert.match(source, /AsyncStorage/, "auth context should persist the last good user profile locally");
  assert.match(source, /USER_CACHE_STORAGE_KEY/, "auth context should use a dedicated cached-user storage key");
  assert.match(source, /restoreCachedUser/, "auth context should restore a cached user profile on startup");
  assert.match(source, /cacheUser/, "auth context should persist the latest successful user bootstrap");
  assert.match(
    source,
    /cachedAt: Date\.now\(\)/,
    "cached user state should record when it was saved so fallback behavior stays bounded"
  );
  assert.match(
    source,
    /cachedUser\.supabaseUserId && cachedUser\.supabaseUserId === session\.user\.id/,
    "cached user fallback should only be reused when it matches the active Supabase session identity"
  );
  assert.match(
    source,
    /cachedEmail && sessionEmail && cachedEmail === sessionEmail/,
    "cached user fallback should accept a verified email match for caches saved before the Supabase id was stored"
  );
  assert.doesNotMatch(
    source,
    /catch \(error: any\) \{[\s\S]*const cachedUser = await restoreCachedUser\(\)[\s\S]*setUser\(cachedUser\)/,
    "top-level startup failures should not blindly restore a cached user without proving which account is active"
  );
  assert.doesNotMatch(source, /setAuthError\(err\?\.\w+\s*\|\|\s*"Failed to load account profile\."\);[\s\S]{0,120}clearAuthSession/, "startup bootstrap failures should not immediately clear a valid persisted session");
  assert.doesNotMatch(source, /setAuthError\("Signed in, but failed to bootstrap your account\."\);[\s\S]{0,120}clearAuthSession/, "auth state listener bootstrap failures should not immediately clear a valid persisted session");
});

test("timezone helpers fail closed instead of throwing on invalid values", () => {
  const source = fs.readFileSync(timezoneUtilsPath, "utf8");

  assert.match(
    source,
    /function isValidDate/,
    "timezone utils should validate dates before formatting them"
  );
  assert.match(
    source,
    /return \"\";/,
    "toDayKeyInAppTimeZone should return an empty key for invalid dates instead of throwing"
  );
  assert.match(
    source,
    /Unknown date|Unknown time|Unknown day/,
    "timezone formatters should provide stable fallback strings for invalid inputs"
  );
});
