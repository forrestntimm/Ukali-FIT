import path from "node:path";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const clientSource = fs.readFileSync(
  path.join(packageRoot, "src/api/client.ts"),
  "utf8"
);

const appSource = fs.readFileSync(
  path.join(packageRoot, "src/App.tsx"),
  "utf8"
);

const pageCacheSource = fs.readFileSync(
  path.join(packageRoot, "src/lib/pageCache.ts"),
  "utf8"
);

const adminWarmupsSource = fs.readFileSync(
  path.join(packageRoot, "src/lib/adminWarmups.ts"),
  "utf8"
);

const dashboardSource = fs.readFileSync(
  path.join(packageRoot, "src/pages/DashboardPage.tsx"),
  "utf8"
);

const membersSource = fs.readFileSync(
  path.join(packageRoot, "src/pages/MembersPage.tsx"),
  "utf8"
);

const paymentsSource = fs.readFileSync(
  path.join(packageRoot, "src/pages/PaymentsPage.tsx"),
  "utf8"
);

const schedulingSource = fs.readFileSync(
  path.join(packageRoot, "src/pages/SchedulingPage.tsx"),
  "utf8"
);

const wodSource = fs.readFileSync(
  path.join(packageRoot, "src/pages/WodPage.tsx"),
  "utf8"
);

const announcementsSource = fs.readFileSync(
  path.join(packageRoot, "src/pages/AnnouncementsPage.tsx"),
  "utf8"
);

test("admin api client uses shared auth token cache instead of fetching supabase session on every request", () => {
  assert.match(clientSource, /getCachedAuthToken/, "client should read from an auth token cache");
  assert.doesNotMatch(
    clientSource,
    /supabase\.auth\.getSession\(\)/,
    "request interceptor should not fetch the Supabase session on every request"
  );
});

test("admin app keeps auth token cache in sync on login and logout", () => {
  assert.match(appSource, /setCachedAuthToken/, "app should prime the auth token cache after login");
  assert.match(appSource, /clearCachedAuthToken/, "app should clear the auth token cache on logout");
});

test("admin page cache keeps a warm in-memory copy for instant same-session reads", () => {
  assert.match(pageCacheSource, /const memoryCache = new Map/, "page cache should keep an in-memory map");
  assert.match(pageCacheSource, /memoryCache\.set\(key, envelope/, "writes should update the in-memory cache");
  assert.match(pageCacheSource, /memoryCache\.get\(key\)/, "reads should check the in-memory cache first");
});

test("admin app warms every tab after auth", () => {
  assert.match(appSource, /warmAllAdminTabData/, "app should warm every admin tab after auth");
  assert.match(adminWarmupsSource, /api\.get\("\/users\/stats"\)/, "warmups should fetch dashboard stats");
  assert.match(adminWarmupsSource, /api\.get\("\/users"\)/, "warmups should fetch full members data");
  assert.match(adminWarmupsSource, /api\.get\("\/users\/member-options"\)/, "warmups should fetch payment athlete options");
  assert.match(adminWarmupsSource, /api\.get\("\/payments\/plans"\)/, "warmups should fetch payment plans");
  assert.match(adminWarmupsSource, /api\.get\("\/payments\/income"\)/, "warmups should fetch payment income tracking");
  assert.match(adminWarmupsSource, /api\.get\("\/users\/coaches"\)/, "warmups should fetch coaches");
  assert.match(adminWarmupsSource, /api\.get\("\/scheduling\/classes"/, "warmups should fetch the current scheduling week");
  assert.match(adminWarmupsSource, /api\.get\("\/workouts"\)/, "warmups should fetch WOD data");
  assert.match(adminWarmupsSource, /api\.get\("\/announcements"\)/, "warmups should fetch announcements data");
});

test("admin app lazy-loads route pages and preloads chunks from navigation intent", () => {
  assert.match(appSource, /lazy\(loadDashboardPage\)/, "dashboard page should be route-split");
  assert.match(appSource, /lazy\(loadMembersPage\)/, "members page should be route-split");
  assert.match(appSource, /lazy\(loadPaymentsPage\)/, "payments page should be route-split");
  assert.match(appSource, /ADMIN_NAV_ITEMS/, "navigation should use a single preloadable route registry");
  assert.match(appSource, /onMouseEnter=\{\(\) => preloadAdminTab\(item\.preload, item\.warmData\)\}/, "nav hover should preload page chunks and data");
  assert.match(appSource, /onFocus=\{\(\) => preloadAdminTab\(item\.preload, item\.warmData\)\}/, "keyboard focus should preload page chunks and data");
});

test("dashboard page restores cached stats before refreshing", () => {
  assert.match(dashboardSource, /readPageCache/, "dashboard should restore warm cache");
  assert.match(dashboardSource, /writePageCache/, "dashboard should persist warm cache");
  assert.match(
    dashboardSource,
    /api\.get\("\/users\/stats"\)/,
    "dashboard should fetch a lightweight stats payload instead of the full users index"
  );
  assert.doesNotMatch(
    dashboardSource,
    /api\.get\("\/users"\)/,
    "dashboard should not fetch the heavy users index just to render summary cards"
  );
  assert.match(dashboardSource, /normalizeDashboardStats/, "dashboard should tolerate older cached stat payloads");
  assert.match(dashboardSource, /stats\.activity/, "dashboard should render the backend activity series");
  assert.match(dashboardSource, /activity\.map/, "dashboard graph should be data-driven instead of hard-coded bars");
  assert.match(dashboardSource, /totalCoachSessions/, "dashboard should expose coach app session totals");
  assert.match(dashboardSource, /totalWorkoutLogs/, "dashboard should expose athlete workout log totals");
});

test("members page restores cached member list before refreshing", () => {
  assert.match(membersSource, /readPageCache/, "members page should restore warm cache");
  assert.match(membersSource, /writePageCache/, "members page should persist warm cache");
  assert.match(membersSource, /ADMIN_MEMBERS_CACHE_KEY/, "members page should use the full members cache key");
});

test("payments page restores cached member and plan data before refreshing", () => {
  assert.match(paymentsSource, /readPageCache/, "payments page should restore warm cache");
  assert.match(paymentsSource, /writePageCache/, "payments page should persist warm cache");
  assert.match(paymentsSource, /MEMBER_OPTIONS_CACHE_KEY/, "payments page should use the lightweight member-options cache key");
  assert.match(paymentsSource, /PAYMENT_INCOME_CACHE_KEY/, "payments page should use the income report cache key");
  assert.match(
    paymentsSource,
    /api\.get\("\/users\/member-options"\)/,
    "payments page should fetch lightweight athlete options instead of the full users index"
  );
  assert.match(
    paymentsSource,
    /api\.get\("\/payments\/income"\)/,
    "payments page should fetch a compact income report instead of calculating revenue in the browser"
  );
  assert.doesNotMatch(
    paymentsSource,
    /api\.get\("\/users"\)/,
    "payments page should not fetch the heavy users index for athlete selection"
  );
});

test("scheduling page restores cached weekly schedule before refreshing", () => {
  assert.match(schedulingSource, /readPageCache/, "scheduling page should restore warm cache");
  assert.match(schedulingSource, /writePageCache/, "scheduling page should persist warm cache");
  assert.match(schedulingSource, /api\.get\("\/users\/coaches"\)/, "scheduling page should fetch the lightweight coaches endpoint");
  assert.doesNotMatch(schedulingSource, /api\.get\("\/users"\)/, "scheduling page should not fetch the heavy users index");
  assert.match(
    schedulingSource,
    /editingAssignmentKey/,
    "scheduling page should only open coach dropdowns when a class cell is being edited"
  );
  assert.match(
    schedulingSource,
    /decorateScheduleItems/,
    "scheduling page should precompute schedule time metadata instead of reformatting every cell on render"
  );
  assert.match(schedulingSource, /SCHEDULE_START_HOUR = 6/, "scheduling page should start the hourly grid at 6 AM");
  assert.match(schedulingSource, /SCHEDULE_END_HOUR = 17/, "scheduling page should include the 5 PM hourly slot");
  assert.match(schedulingSource, /HOURLY_TIME_KEYS/, "scheduling page should render default hourly slots for empty weeks");
  assert.match(
    schedulingSource,
    /createScheduleSlotAssignment/,
    "scheduling page should save coach assignments from open hourly slots"
  );
  assert.match(
    schedulingSource,
    /api\.post<ScheduleItem>\("\/scheduling\/classes"/,
    "scheduling page should create schedule entries through the scheduling API"
  );
  assert.match(
    schedulingSource,
    /className="schedule-coach-select"/,
    "scheduling page should render coach dropdowns inside editable schedule cells"
  );
  assert.doesNotMatch(
    schedulingSource,
    /No classes found for this week/,
    "scheduling page should show an hourly grid instead of hiding empty weeks"
  );
});

test("wod page restores cached workouts before refreshing", () => {
  assert.match(wodSource, /readPageCache/, "wod page should restore warm cache");
  assert.match(wodSource, /writePageCache/, "wod page should persist warm cache");
});

test("announcements page restores cached announcements before refreshing", () => {
  assert.match(announcementsSource, /readPageCache/, "announcements page should restore warm cache");
  assert.match(announcementsSource, /writePageCache/, "announcements page should persist warm cache");
});
