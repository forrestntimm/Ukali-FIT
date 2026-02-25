import { PaymentMethod, PaymentState, PaymentStatus } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "../utils/prisma";
import { config } from "../utils/config";

const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey, { apiVersion: "2024-06-20" }) : null;

export async function createStripePaymentIntent(userId: string, amount: number) {
  if (!stripe) throw new Error("Stripe not configured");

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    metadata: { userId }
  });

  await prisma.payment.create({
    data: {
      userId,
      amount,
      method: PaymentMethod.PHONE_PAY,
      status: PaymentState.PENDING,
      stripePaymentIntentId: paymentIntent.id
    }
  });

  return paymentIntent;
}

export async function markManualPayment(userId: string, amount: number, date?: Date) {
  const payment = await prisma.payment.create({
    data: {
      userId,
      amount,
      method: PaymentMethod.CASH,
      status: PaymentState.SUCCESS,
      date: date || new Date()
    }
  });

  await updateUserPaymentStatus(userId, PaymentMethod.CASH);
  return payment;
}

export async function updateUserPaymentStatus(userId: string, method: PaymentMethod) {
  const nextPaymentDue = addMonths(new Date(), 1);
  return prisma.user.update({
    where: { id: userId },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: method,
      nextPaymentDue
    }
  });
}

export async function listPaymentsByUser(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { date: "desc" }
  });
}

export async function handleStripeWebhook(signature: string | string[] | undefined, body: Buffer) {
  if (!stripe) throw new Error("Stripe not configured");
  if (!config.stripeWebhookSecret) throw new Error("Stripe webhook secret missing");

  const event = stripe.webhooks.constructEvent(body, signature as string, config.stripeWebhookSecret);
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const userId = intent.metadata?.userId;
    if (userId) {
      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: intent.id },
        data: { status: PaymentState.SUCCESS, date: new Date() }
      });
      await updateUserPaymentStatus(userId, PaymentMethod.PHONE_PAY);
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    await prisma.payment.updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: { status: PaymentState.FAILED }
    });
  }

  return event;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date.getTime());
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

export async function markOverdueMembers() {
  const now = new Date();
  await prisma.user.updateMany({
    where: {
      nextPaymentDue: { lt: now },
      paymentStatus: PaymentStatus.PAID
    },
    data: { paymentStatus: PaymentStatus.UNPAID }
  });
}
