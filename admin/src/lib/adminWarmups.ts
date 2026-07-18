import { api } from "../api/client";
import { isPageCacheFresh, readPageCache, writePageCache } from "./pageCache";

const APP_TIME_ZONE = "Asia/Kathmandu";

export const DASHBOARD_STATS_CACHE_KEY = "admin-dashboard-stats";
export const DASHBOARD_STATS_TTL_MS = 2 * 60 * 1000;
export const ADMIN_MEMBERS_CACHE_KEY = "admin-users";
export const ADMIN_MEMBERS_TTL_MS = 2 * 60 * 1000;
export const MEMBER_OPTIONS_CACHE_KEY = "admin-member-options";
export const PAYMENT_PLANS_CACHE_KEY = "payment-plans";
export const PAYMENTS_BOOTSTRAP_TTL_MS = 5 * 60 * 1000;
export const COACHES_CACHE_KEY = "admin-coaches";
export const SCHEDULING_CACHE_TTL_MS = 5 * 60 * 1000;
export const WORKOUTS_CACHE_KEY = "workouts-list";
export const WORKOUTS_CACHE_TTL_MS = 5 * 60 * 1000;
export const ANNOUNCEMENTS_CACHE_KEY = "announcements-list";
export const ANNOUNCEMENTS_CACHE_TTL_MS = 2 * 60 * 1000;

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const inflightWarmups = new Map<string, Promise<void>>();

function getDateKeyInAppTimeZone(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = DATE_KEY_FORMATTER
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftDateKey(dateKey: string, days: number) {
  const base = new Date(`${dateKey}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function getWeekStartKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return shiftDateKey(dateKey, -daysSinceMonday);
}

export function getCurrentSchedulingCacheKey() {
  const todayKey = getDateKeyInAppTimeZone(new Date());
  const weekStartKey = getWeekStartKey(todayKey);
  const weekEndKey = shiftDateKey(weekStartKey, 4);
  return {
    weekStartKey,
    weekEndKey,
    scheduleCacheKey: `scheduling:${weekStartKey}:${weekEndKey}`,
    from: `${weekStartKey}T00:00:00.000Z`,
    to: `${weekEndKey}T23:59:59.999Z`
  };
}

function hasFreshCache(key: string, ttlMs: number) {
  const cached = readPageCache<unknown>(key);
  return Boolean(cached && isPageCacheFresh(cached.savedAt, ttlMs));
}

function warmCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options: { force?: boolean; shouldWrite?: () => boolean } = {}
) {
  if (!options.force && hasFreshCache(key, ttlMs)) return Promise.resolve();

  const inflightKey = `${key}:${options.force ? "force" : "fresh"}`;
  const existing = inflightWarmups.get(inflightKey);
  if (existing) return existing;

  const promise = fetcher()
    .then((data) => {
      if (options.shouldWrite?.() === false) return;
      writePageCache(key, data);
    })
    .catch(() => {})
    .finally(() => {
      inflightWarmups.delete(inflightKey);
    });

  inflightWarmups.set(inflightKey, promise);
  return promise;
}

export function warmDashboardData(options: { shouldWrite?: () => boolean } = {}) {
  return warmCache(DASHBOARD_STATS_CACHE_KEY, DASHBOARD_STATS_TTL_MS, async () => {
    const res = await api.get("/users/stats");
    return res.data;
  }, options);
}

export function warmMembersData(options: { shouldWrite?: () => boolean } = {}) {
  return warmCache(ADMIN_MEMBERS_CACHE_KEY, ADMIN_MEMBERS_TTL_MS, async () => {
    const res = await api.get("/users");
    return res.data;
  }, options);
}

export function warmPaymentsData(options: { shouldWrite?: () => boolean } = {}) {
  return Promise.all([
    warmCache(MEMBER_OPTIONS_CACHE_KEY, PAYMENTS_BOOTSTRAP_TTL_MS, async () => {
      const res = await api.get("/users/member-options");
      return res.data;
    }, options),
    warmCache(PAYMENT_PLANS_CACHE_KEY, PAYMENTS_BOOTSTRAP_TTL_MS, async () => {
      const res = await api.get("/payments/plans");
      return res.data;
    }, options)
  ]).then(() => {});
}

export function warmSchedulingData(options: { shouldWrite?: () => boolean } = {}) {
  const { scheduleCacheKey, from, to } = getCurrentSchedulingCacheKey();
  return Promise.all([
    warmCache(COACHES_CACHE_KEY, SCHEDULING_CACHE_TTL_MS, async () => {
      const res = await api.get("/users/coaches");
      return res.data;
    }, options),
    warmCache(scheduleCacheKey, SCHEDULING_CACHE_TTL_MS, async () => {
      const res = await api.get("/scheduling/classes", { params: { from, to } });
      return res.data;
    }, options)
  ]).then(() => {});
}

export function warmWorkoutsData(options: { shouldWrite?: () => boolean } = {}) {
  return warmCache(WORKOUTS_CACHE_KEY, WORKOUTS_CACHE_TTL_MS, async () => {
    const res = await api.get("/workouts");
    return [...res.data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, options);
}

export function warmAnnouncementsData(options: { shouldWrite?: () => boolean } = {}) {
  return warmCache(ANNOUNCEMENTS_CACHE_KEY, ANNOUNCEMENTS_CACHE_TTL_MS, async () => {
    const res = await api.get("/announcements");
    return res.data;
  }, options);
}

export function warmAllAdminTabData(options: { shouldWrite?: () => boolean } = {}) {
  return Promise.all([
    warmDashboardData(options),
    warmMembersData(options),
    warmPaymentsData(options),
    warmSchedulingData(options),
    warmWorkoutsData(options),
    warmAnnouncementsData(options)
  ]).then(() => {});
}
