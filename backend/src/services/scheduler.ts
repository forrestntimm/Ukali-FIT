import cron from "node-cron";
import { sendPaymentReminders, sendOverdueAlerts, sendClassReminders } from "./notificationService";
import { markOverdueMembers } from "./paymentService";
import { logger } from "../utils/logger";

export function startSchedulers() {
  // Run daily at 8am server time
  cron.schedule("0 8 * * *", async () => {
    try {
      await markOverdueMembers();
      await sendPaymentReminders();
      await sendOverdueAlerts();
      await sendClassReminders();
    } catch (err) {
      logger.error({ err }, "Scheduler failed");
    }
  });
}
