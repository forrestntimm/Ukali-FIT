import { Router } from "express";
import { handleStripeWebhook } from "../services/paymentService";

const router = Router();

router.post("/stripe", async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    await handleStripeWebhook(signature, req.body);
    return res.json({ received: true });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || "Webhook error" });
  }
});

export default router;
