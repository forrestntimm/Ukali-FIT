import { Expo } from "expo-server-sdk";
import { config } from "../utils/config";
import { prisma } from "../utils/prisma";
import { logger } from "../utils/logger";
import { removeBlockedClassTimes } from "../utils/classTimeRules";

const expo = new Expo({ accessToken: config.expoAccessToken || undefined });
const APP_TIME_ZONE = "Asia/Kathmandu";

export async function registerDeviceToken(userId: string, token: string, platform: string) {
  return prisma.deviceToken.upsert({
    where: { token },
    update: { userId, platform, badgeCount: 0 },
    create: { userId, token, platform, badgeCount: 0 }
  });
}

type DeviceTokenRecord = {
  id: string;
  token: string;
  badgeCount: number;
};

// Push sends only need token identifiers; selecting narrowly avoids dragging
// full user rows (profile images, records) through every notification query.
const deviceTokenSelect = {
  id: true,
  token: true,
  badgeCount: true
} as const;

export async function clearDeviceBadgeCount(token: string) {
  return prisma.deviceToken.updateMany({
    where: { token },
    data: { badgeCount: 0 }
  });
}

export async function sendNotification(
  devices: DeviceTokenRecord[],
  title: string,
  body: string,
  data?: Record<string, any>,
  options: { incrementBadge?: boolean } = {}
) {
  const incrementBadge = options.incrementBadge === true;
  const eligibleDevices = devices.filter((device) => Expo.isExpoPushToken(device.token));
  const badgeUpdates = eligibleDevices.map((device) => ({
    id: device.id,
    token: device.token,
    badgeCount: incrementBadge ? device.badgeCount + 1 : device.badgeCount
  }));
  const messages = badgeUpdates.map((device) => ({
    to: device.token,
    sound: "default",
    title,
    body,
    data,
    ...(incrementBadge ? { badge: device.badgeCount } : {})
  }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      logger.error({ err }, "Failed to send push notification");
    }
  }

  if (incrementBadge && badgeUpdates.length > 0) {
    await prisma.$transaction(
      badgeUpdates.map((device) =>
        prisma.deviceToken.update({
          where: { id: device.id },
          data: { badgeCount: device.badgeCount }
        })
      )
    );
  }
}

export async function sendPaymentReminders() {
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      nextPaymentDue: { gte: now, lte: threeDays },
      paymentStatus: "PAID"
    },
    select: { id: true, nextPaymentDue: true, deviceTokens: { select: deviceTokenSelect } }
  });

  for (const user of users) {
    if (user.deviceTokens.length === 0) continue;

    const dueDate = user.nextPaymentDue?.toISOString().split("T")[0];
    await sendNotification(
      user.deviceTokens,
      "Payment Due",
      `Your payment is due ${dueDate ? `on ${dueDate}` : "soon"}.`,
      {
        type: "payment_due"
      },
      { incrementBadge: true }
    );
  }
}

export async function sendOverdueAlerts() {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: {
      nextPaymentDue: { lt: now },
      paymentStatus: "UNPAID"
    },
    select: { id: true, deviceTokens: { select: deviceTokenSelect } }
  });

  for (const user of users) {
    if (user.deviceTokens.length === 0) continue;

    await sendNotification(
      user.deviceTokens,
      "Payment Overdue",
      "Your membership payment is overdue. Please pay to stay active.",
      {
        type: "payment_overdue"
      },
      { incrementBadge: true }
    );
  }
}

export async function sendAnnouncementNotification(args: { announcementId: string; title: string; body: string }) {
  const tokens = await prisma.deviceToken.findMany({
    select: { id: true, token: true, badgeCount: true }
  });
  const deduped = Array.from(new Map(tokens.map((device) => [device.token, device])).values());
  if (deduped.length === 0) return;

  await sendNotification(
    deduped,
    "New Announcement",
    args.title,
    {
      type: "announcement",
      announcementId: args.announcementId,
      title: args.title,
      body: args.body
    },
    { incrementBadge: true }
  );
}

function formatDateInAppTimeZone(date: Date) {
  return new Intl.DateTimeFormat("en-NP", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export async function sendWeeklyWorkoutsUploadedNotification(args: { weekStart: Date; weekEnd: Date }) {
  const coaches = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, deviceTokens: { select: deviceTokenSelect } }
  });

  const tokens = Array.from(new Map(coaches.flatMap((coach) => coach.deviceTokens).map((token) => [token.token, token])).values());
  if (tokens.length === 0) return;

  const rangeLabel = `${formatDateInAppTimeZone(args.weekStart)} - ${formatDateInAppTimeZone(args.weekEnd)}`;
  await sendNotification(tokens, "Weekly Workouts Uploaded", `Workout programming for ${rangeLabel} is now live.`, {
    type: "weekly_workouts_uploaded",
    weekStart: args.weekStart.toISOString(),
    weekEnd: args.weekEnd.toISOString()
  });
}

function formatCoachScheduleDate(date: Date) {
  return new Intl.DateTimeFormat("en-NP", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

export async function sendCoachScheduleNotification(args: {
  coachId: string;
  classId: string;
  classTitle: string;
  classDateTime: Date;
}) {
  const coach = await prisma.user.findUnique({
    where: { id: args.coachId },
    select: { id: true, deviceTokens: { select: deviceTokenSelect } }
  });

  if (!coach) return;
  if (coach.deviceTokens.length === 0) return;

  const formattedDate = formatCoachScheduleDate(args.classDateTime);
  await sendNotification(
    coach.deviceTokens,
    "Coaching Schedule Updated",
    `${args.classTitle} on ${formattedDate}`,
    {
      type: "coach_schedule",
      classId: args.classId,
      coachId: args.coachId,
      datetime: args.classDateTime.toISOString()
    },
    { incrementBadge: true }
  );
}

export async function sendClassReminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const classes = await prisma.class.findMany({
    where: { datetime: { gte: now, lte: soon } },
    select: {
      id: true,
      title: true,
      datetime: true,
      signups: {
        select: {
          user: {
            select: { deviceTokens: { select: deviceTokenSelect } }
          }
        }
      }
    }
  });

  for (const klass of removeBlockedClassTimes(classes)) {
    // One batched send per class: every signed-up member gets the same message.
    const devices = Array.from(
      new Map(
        klass.signups
          .flatMap((signup) => signup.user.deviceTokens)
          .map((device) => [device.token, device])
      ).values()
    );
    if (devices.length === 0) continue;
    await sendNotification(devices, "Class Reminder", `${klass.title} is coming up soon.`, {
      type: "class_reminder",
      classId: klass.id
    });
  }
}
