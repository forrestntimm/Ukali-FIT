import cron from "node-cron";
import { sendPaymentReminders, sendOverdueAlerts, sendClassReminders } from "./notificationService";
import { markOverdueMembers } from "./paymentService";
import { logger } from "../utils/logger";

export async function runDailyMaintenance() {
  await markOverdueMembers();
  await sendPaymentReminders();
  await sendOverdueAlerts();
  await sendClassReminders();
}

export function startSchedulers() {
  // Run daily at 8am server time
  cron.schedule("0 8 * * *", async () => {
    try {
      await runDailyMaintenance();
    } catch (err) {
      logger.error({ err }, "Scheduler failed");
    }
  });
}
