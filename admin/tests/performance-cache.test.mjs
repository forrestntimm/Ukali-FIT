import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const clientSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/api/client.ts",
  "utf8"
);

const appSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/App.tsx",
  "utf8"
);

const pageCacheSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/lib/pageCache.ts",
  "utf8"
);

const dashboardSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/pages/DashboardPage.tsx",
  "utf8"
);

const membersSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/pages/MembersPage.tsx",
  "utf8"
);

const paymentsSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/pages/PaymentsPage.tsx",
  "utf8"
);

const schedulingSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/pages/SchedulingPage.tsx",
  "utf8"
);

const wodSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/pages/WodPage.tsx",
  "utf8"
);

const announcementsSource = fs.readFileSync(
  "/Users/forresttimm/Documents/Ukali sign in app/admin/src/pages/AnnouncementsPage.tsx",
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

test("admin app prefetches dashboard and scheduling data after auth", () => {
  assert.match(appSource, /api\s*\.\s*get\("\/users\/stats"\)/, "app should warm dashboard stats after auth");
  assert.match(appSource, /api\s*\.\s*get\("\/users\/coaches"\)/, "app should warm coaches after auth");
  assert.match(appSource, /api\s*\.\s*get\("\/scheduling\/classes"/, "app should warm the current scheduling week after auth");
  assert.match(appSource, /writePageCache\("admin-coaches"/, "app should write warm coach data into shared cache");
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
});

test("members page restores cached member list before refreshing", () => {
  assert.match(membersSource, /readPageCache/, "members page should restore warm cache");
  assert.match(membersSource, /writePageCache/, "members page should persist warm cache");
});

test("payments page restores cached member and plan data before refreshing", () => {
  assert.match(paymentsSource, /readPageCache/, "payments page should restore warm cache");
  assert.match(paymentsSource, /writePageCache/, "payments page should persist warm cache");
  assert.match(
    paymentsSource,
    /api\.get\("\/users\/member-options"\)/,
    "payments page should fetch lightweight athlete options instead of the full users index"
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
});

test("wod page restores cached workouts before refreshing", () => {
  assert.match(wodSource, /readPageCache/, "wod page should restore warm cache");
  assert.match(wodSource, /writePageCache/, "wod page should persist warm cache");
});

test("announcements page restores cached announcements before refreshing", () => {
  assert.match(announcementsSource, /readPageCache/, "announcements page should restore warm cache");
  assert.match(announcementsSource, /writePageCache/, "announcements page should persist warm cache");
});
