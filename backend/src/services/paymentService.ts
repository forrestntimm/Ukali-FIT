import { PaymentMethod, PaymentState, PaymentStatus, Role } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "../utils/prisma";
import { getPaymentPlan, type PaymentPlan } from "./paymentPlans";
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

export async function markManualPayment(
  userId: string,
  input: {
    planCode: string;
    quantity?: number;
    date?: Date;
  }
) {
  const plan = getPaymentPlan(input.planCode);
  if (!plan) {
    throw new Error("Unknown payment plan");
  }

  await assertManualPaymentTarget(userId);

  const quantity = plan.quantityEnabled ? Math.max(1, input.quantity || 1) : 1;
  const paidAt = input.date || new Date();
  const amount = plan.amount * quantity;
  const payment = await prisma.payment.create({
    data: {
      userId,
      amount,
      planCode: plan.code,
      planName: plan.name,
      quantity,
      method: PaymentMethod.CASH,
      status: PaymentState.SUCCESS,
      date: paidAt
    }
  });

  await updateUserPaymentStatus(userId, PaymentMethod.CASH, plan, paidAt);
  return payment;
}

async function assertManualPaymentTarget(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      inviteAcceptedAt: true,
      lastLoginAt: true
    }
  });

  if (!user) {
    const err = new Error("Athlete not found") as Error & { status?: number; code?: string };
    err.status = 404;
    err.code = "PAYMENT_MEMBER_NOT_FOUND";
    throw err;
  }

  if (user.role !== Role.MEMBER || (!user.inviteAcceptedAt && !user.lastLoginAt)) {
    const err = new Error("Payments can only be recorded for activated athlete profiles") as Error & {
      status?: number;
      code?: string;
    };
    err.status = 409;
    err.code = "PAYMENT_TARGET_NOT_ACTIVE_MEMBER";
    throw err;
  }
}

export async function updateUserPaymentStatus(
  userId: string,
  method: PaymentMethod,
  plan?: PaymentPlan,
  paidAt = new Date()
) {
  const effectivePlan = plan || getPaymentPlan("MONTHLY");
  if (!effectivePlan) {
    throw new Error("Monthly payment plan is not configured");
  }

  const nextPaymentDue = calculateNextPaymentDue(effectivePlan, paidAt);
  return prisma.user.update({
    where: { id: userId },
    data: {
      membershipStart: paidAt,
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

function addDays(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addYears(date: Date, years: number) {
  const copy = new Date(date.getTime());
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

function calculateNextPaymentDue(plan: PaymentPlan, paidAt: Date) {
  if (plan.durationUnit === "DAY") {
    return addDays(paidAt, plan.durationCount);
  }

  if (plan.durationUnit === "WEEK") {
    return addDays(paidAt, plan.durationCount * 7);
  }

  if (plan.durationUnit === "YEAR") {
    return addYears(paidAt, plan.durationCount);
  }

  return addMonths(paidAt, plan.durationCount);
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
