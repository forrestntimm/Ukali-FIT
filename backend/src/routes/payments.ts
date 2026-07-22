import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import {
  createStripePaymentIntent,
  getIncomeReport,
  listPaymentsByUser,
  markManualPayment
} from "../services/paymentService";
import { PAYMENT_PLANS, listPaymentPlans } from "../services/paymentPlans";
import { config } from "../utils/config";

const router = Router();
const paymentPlanCodes = PAYMENT_PLANS.map((plan) => plan.code) as [string, ...string[]];

const intentSchema = z.object({
  body: z.object({
    amount: z.number().int().min(100)
  })
});

const manualSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    planCode: z.enum(paymentPlanCodes),
    quantity: z.number().int().min(1).max(50).optional(),
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

router.get("/plans", requireAuth, async (_req, res) => {
  return res.json(listPaymentPlans());
});

router.get("/income", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  return res.json(await getIncomeReport());
});

router.post("/manual", requireAuth, requireRole("ADMIN"), validate(manualSchema), async (req, res) => {
  try {
    const { userId, planCode, quantity, date } = req.body;
    const payment = await markManualPayment(userId, {
      planCode,
      quantity,
      date: date ? new Date(date) : undefined
    });
    return res.status(201).json(payment);
  } catch (err: any) {
    return res.status(err?.status || 400).json({
      code: err?.code || "PAYMENT_MANUAL_FAILED",
      message: err?.message || "Failed to record payment"
    });
  }
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
