import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { registerDeviceToken } from "../services/notificationService";

const router = Router();

const registerSchema = z.object({
  body: z.object({
    token: z.string().min(10),
    platform: z.string().min(2)
  })
});

router.post("/register", requireAuth, validate(registerSchema), async (req, res) => {
  const { token, platform } = req.body;
  const record = await registerDeviceToken(req.user!.id, token, platform);
  return res.status(201).json(record);
});

export default router;
