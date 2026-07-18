import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const notificationServicePath = path.resolve(
  path.join(packageRoot, "src/services/notificationService.ts")
);
const backendVercelPath = path.resolve(
  path.join(packageRoot, "vercel.json")
);
const usersRoutePath = path.resolve(
  path.join(packageRoot, "src/routes/users.ts")
);
const announcementsRoutePath = path.resolve(
  path.join(packageRoot, "src/routes/announcements.ts")
);

test("payment reminders target active members before expiry, not already-unpaid accounts", () => {
  const source = fs.readFileSync(notificationServicePath, "utf8");
  const reminderFunctionBlock = source.match(/export async function sendPaymentReminders\(\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(source, /sendPaymentReminders/, "notification service should define sendPaymentReminders");
  assert.match(reminderFunctionBlock, /paymentStatus:\s*"PAID"/, "payment reminders should target active paid members");
  assert.doesNotMatch(reminderFunctionBlock, /paymentStatus:\s*"UNPAID"/, "payment reminder query should not target already-unpaid accounts");
});

test("backend Vercel config defines a production cron job for scheduled notifications", () => {
  const source = fs.readFileSync(backendVercelPath, "utf8");

  assert.match(source, /"crons"\s*:/, "backend vercel.json should define cron jobs");
});

test("invite routes resolve redirect targets through an allowlisted callback helper", () => {
  const source = fs.readFileSync(usersRoutePath, "utf8");

  assert.match(source, /resolveAllowedCallbackUrl/, "invite routes should normalize redirect targets through an allowlisted helper");
});

test("announcement pushes send full announcement content to registered mobile devices", () => {
  const notificationSource = fs.readFileSync(notificationServicePath, "utf8");
  const announcementRouteSource = fs.readFileSync(announcementsRoutePath, "utf8");
  const announcementBlock =
    notificationSource.match(/export async function sendAnnouncementNotification\([\s\S]*?\n\}/)?.[0] || "";

  assert.match(announcementBlock, /body:\s*string/, "announcement push helper should accept announcement body text");
  assert.match(announcementBlock, /announcementId:\s*string/, "announcement push helper should accept announcement id");
  assert.match(announcementBlock, /new Map\(tokens\.map\(\(device\) => \[device\.token, device\]\)\)\.values\(\)/, "announcement pushes should dedupe device tokens");
  assert.match(announcementBlock, /"New Announcement"/, "announcement pushes should use a consistent title");
  assert.match(announcementBlock, /announcementId/, "announcement push payload should include the announcement id");
  assert.match(announcementBlock, /incrementBadge:\s*true/, "announcement pushes should increment the app icon badge");
  assert.match(announcementRouteSource, /await sendAnnouncementNotification\(\{/, "announcement route should pass structured announcement data to the push helper");
});

test("badge counts are tracked on device tokens and only increment for selected notification types", () => {
  const notificationSource = fs.readFileSync(notificationServicePath, "utf8");
  const weeklyWorkoutsBlock =
    notificationSource.match(/export async function sendWeeklyWorkoutsUploadedNotification\([\s\S]*?\n\}/)?.[0] || "";
  const classRemindersBlock =
    notificationSource.match(/export async function sendClassReminders\([\s\S]*?\n\}/)?.[0] || "";

  assert.match(notificationSource, /badgeCount:\s*0/, "device token registration should reset badge count when the app reopens");
  assert.match(notificationSource, /badge:\s*device\.badgeCount/, "push payloads should include the next badge count when incrementing");
  assert.match(notificationSource, /clearDeviceBadgeCount/, "notification service should expose badge clearing support");
  assert.match(notificationSource, /sendPaymentReminders[\s\S]*incrementBadge:\s*true/, "payment-due reminders should increment app icon badges");
  assert.match(notificationSource, /sendOverdueAlerts[\s\S]*incrementBadge:\s*true/, "payment overdue alerts should increment app icon badges");
  assert.match(notificationSource, /sendCoachScheduleNotification[\s\S]*incrementBadge:\s*true/, "coach schedule changes should increment app icon badges");
  assert.doesNotMatch(weeklyWorkoutsBlock, /incrementBadge:\s*true/, "weekly workout uploads should not increment app icon badges by default");
  assert.doesNotMatch(classRemindersBlock, /incrementBadge:\s*true/, "class reminders should not increment app icon badges by default");
});
