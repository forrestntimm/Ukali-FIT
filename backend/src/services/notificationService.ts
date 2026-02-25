import { Expo } from "expo-server-sdk";
import { config } from "../utils/config";
import { prisma } from "../utils/prisma";
import { logger } from "../utils/logger";

const expo = new Expo({ accessToken: config.expoAccessToken || undefined });

export async function registerDeviceToken(userId: string, token: string, platform: string) {
  return prisma.deviceToken.upsert({
    where: { token },
    update: { userId, platform },
    create: { userId, token, platform }
  });
}

export async function sendNotification(tokens: string[], title: string, body: string, data?: Record<string, any>) {
  const messages = tokens
    .filter((token) => Expo.isExpoPushToken(token))
    .map((token) => ({ to: token, sound: "default", title, body, data }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      logger.error({ err }, "Failed to send push notification");
    }
  }
}

export async function sendPaymentReminders() {
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      nextPaymentDue: { lte: threeDays },
      paymentStatus: "UNPAID"
    },
    include: { deviceTokens: true }
  });

  for (const user of users) {
    const tokens = user.deviceTokens.map((t) => t.token);
    if (tokens.length === 0) continue;

    const dueDate = user.nextPaymentDue?.toISOString().split("T")[0];
    await sendNotification(tokens, "Payment Due", `Your payment is due ${dueDate ? `on ${dueDate}` : "soon"}.`, {
      type: "payment_due"
    });
  }
}

export async function sendOverdueAlerts() {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: {
      nextPaymentDue: { lt: now },
      paymentStatus: "UNPAID"
    },
    include: { deviceTokens: true }
  });

  for (const user of users) {
    const tokens = user.deviceTokens.map((t) => t.token);
    if (tokens.length === 0) continue;

    await sendNotification(tokens, "Payment Overdue", "Your membership payment is overdue. Please pay to stay active.", {
      type: "payment_overdue"
    });
  }
}

export async function sendAnnouncementNotification(title: string) {
  const tokens = await prisma.deviceToken.findMany();
  const list = tokens.map((t) => t.token);
  if (list.length === 0) return;

  await sendNotification(list, "New Announcement", title, { type: "announcement" });
}

export async function sendClassReminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const classes = await prisma.class.findMany({
    where: { datetime: { gte: now, lte: soon } },
    include: { signups: { include: { user: { include: { deviceTokens: true } } } } }
  });

  for (const klass of classes) {
    for (const signup of klass.signups) {
      const tokens = signup.user.deviceTokens.map((t) => t.token);
      if (tokens.length === 0) continue;
      await sendNotification(tokens, "Class Reminder", `${klass.title} is coming up soon.`, {
        type: "class_reminder",
        classId: klass.id
      });
    }
  }
}
