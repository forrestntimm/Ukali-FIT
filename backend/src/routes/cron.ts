import { Router } from "express";
import { runDailyMaintenance } from "../services/scheduler";
import { config } from "../utils/config";

const router = Router();

function isAuthorizedCronRequest(authorizationHeader: string | string[] | undefined) {
  if (!config.cronSecret) return false;
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  return header === `Bearer ${config.cronSecret}`;
}

router.get("/daily", async (req, res) => {
  if (!isAuthorizedCronRequest(req.headers.authorization)) {
    return res.status(401).json({
      code: "CRON_UNAUTHORIZED",
      message: "Missing or invalid cron authorization."
    });
  }

  await runDailyMaintenance();
  return res.json({ ok: true });
});

export default router;
