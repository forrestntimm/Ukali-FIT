import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import { createStripePaymentIntent, listPaymentsByUser, markManualPayment } from "../services/paymentService";
import { config } from "../utils/config";

const router = Router();

const intentSchema = z.object({
  body: z.object({
    amount: z.number().int().min(100)
  })
});

const manualSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    amount: z.number().int().min(100),
    date: z.string().datetime().optional()
  })
});

router.post("/intent", requireAuth, validate(intentSchema), async (req, res) => {
  if (!config.memberPaymentsEnabled && req.user?.role !== "ADMIN") {
    return res.status(403).json({
      code: "PAYMENTS_MEMBER_DISABLED",
      message: "Member payments are currently disabled."
    });
  }

  const { amount } = req.body;
  const userId = req.user!.id;
  const intent = await createStripePaymentIntent(userId, amount);
  return res.json({ clientSecret: intent.client_secret });
});

router.post("/manual", requireAuth, requireRole("ADMIN"), validate(manualSchema), async (req, res) => {
  const { userId, amount, date } = req.body;
  const payment = await markManualPayment(userId, amount, date ? new Date(date) : undefined);
  return res.status(201).json(payment);
});

router.get("/me", requireAuth, async (req, res) => {
  if (!config.memberPaymentsEnabled && req.user?.role !== "ADMIN") {
    return res.status(403).json({
      code: "PAYMENTS_MEMBER_DISABLED",
      message: "Member payments are currently disabled."
    });
  }

  const payments = await listPaymentsByUser(req.user!.id);
  return res.json(payments);
});

export default router;
