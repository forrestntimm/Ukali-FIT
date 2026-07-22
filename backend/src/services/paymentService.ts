import { PaymentMethod, PaymentState, PaymentStatus, Role } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "../utils/prisma";
import { getPaymentPlan, type PaymentPlan } from "./paymentPlans";
import { config } from "../utils/config";
import { clearDashboardCaches } from "./userService";
import { clearResponseCache, readResponseCache, writeResponseCache } from "../utils/responseCache";

const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey, { apiVersion: "2024-06-20" }) : null;
const INCOME_REPORT_CACHE_KEY = "payments:income-report";
const INCOME_REPORT_TTL_MS = 30 * 1000;
const APP_TIME_ZONE = "Asia/Kathmandu";
const NEPAL_OFFSET_MINUTES = 5 * 60 + 45;

type IncomeReportPayment = {
  id: string;
  date: Date;
  amount: number;
  method: PaymentMethod;
  status: PaymentState;
  planCode: string | null;
  planName: string | null;
  quantity: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

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
  clearDashboardCaches();
  clearPaymentReportCaches();
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

export function clearPaymentReportCaches() {
  clearResponseCache("payments:");
}

export async function getIncomeReport() {
  const cached = readResponseCache<ReturnType<typeof buildIncomeReport>>(INCOME_REPORT_CACHE_KEY);
  if (cached) return cached;

  const bounds = getIncomeWindowBounds(new Date());
  const [successfulPayments, unpaidMembers] = await prisma.$transaction([
    prisma.payment.findMany({
      where: { status: PaymentState.SUCCESS },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        amount: true,
        method: true,
        status: true,
        planCode: true,
        planName: true,
        quantity: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    }),
    prisma.user.findMany({
      where: {
        role: Role.MEMBER,
        paymentStatus: PaymentStatus.UNPAID,
        OR: [{ inviteAcceptedAt: { not: null } }, { lastLoginAt: { not: null } }]
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        paymentStatus: true,
        nextPaymentDue: true
      }
    })
  ]);

  const report = buildIncomeReport(successfulPayments, unpaidMembers, bounds);
  return writeResponseCache(INCOME_REPORT_CACHE_KEY, report, INCOME_REPORT_TTL_MS);
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
      clearDashboardCaches();
      clearPaymentReportCaches();
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
  clearDashboardCaches();
  clearPaymentReportCaches();
}

function buildIncomeReport(
  successfulPayments: IncomeReportPayment[],
  unpaidMembers: Array<{
    id: string;
    name: string;
    email: string;
    paymentStatus: PaymentStatus;
    nextPaymentDue: Date | null;
  }>,
  bounds: ReturnType<typeof getIncomeWindowBounds>
) {
  const totals = {
    today: 0,
    week: 0,
    month: 0,
    year: 0,
    allTime: 0
  };
  const byMethod = new Map<PaymentMethod, { method: PaymentMethod; total: number; count: number }>();
  const byPlan = new Map<string, { planCode: string; planName: string; total: number; count: number; quantity: number }>();

  for (const payment of successfulPayments) {
    totals.allTime += payment.amount;
    if (payment.date >= bounds.todayStart) totals.today += payment.amount;
    if (payment.date >= bounds.weekStart) totals.week += payment.amount;
    if (payment.date >= bounds.monthStart) totals.month += payment.amount;
    if (payment.date >= bounds.yearStart) totals.year += payment.amount;

    const method = byMethod.get(payment.method) || { method: payment.method, total: 0, count: 0 };
    method.total += payment.amount;
    method.count += 1;
    byMethod.set(payment.method, method);

    const planKey = payment.planCode || "UNTRACKED";
    const plan = byPlan.get(planKey) || {
      planCode: planKey,
      planName: payment.planName || "Untracked payment",
      total: 0,
      count: 0,
      quantity: 0
    };
    plan.total += payment.amount;
    plan.count += 1;
    plan.quantity += payment.quantity || 1;
    byPlan.set(planKey, plan);
  }

  return {
    generatedAt: new Date().toISOString(),
    currency: "NPR" as const,
    totals,
    counts: {
      successfulPayments: successfulPayments.length,
      unpaidMembers: unpaidMembers.length
    },
    byMethod: [...byMethod.values()].sort((a, b) => b.total - a.total),
    byPlan: [...byPlan.values()].sort((a, b) => b.total - a.total),
    recentPayments: successfulPayments.slice(0, 10).map((payment) => ({
      id: payment.id,
      date: payment.date,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      planCode: payment.planCode,
      planName: payment.planName,
      quantity: payment.quantity,
      user: payment.user
    })),
    unpaidMembers: unpaidMembers.slice(0, 12)
  };
}

function getIncomeWindowBounds(now: Date) {
  const { year, month, day } = getAppDateParts(now);
  const todayStart = toAppLocalBoundaryUtc(year, month, day);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (calendarDate.getUTCDay() + 6) % 7;
  const weekStartCalendarDate = new Date(calendarDate.getTime());
  weekStartCalendarDate.setUTCDate(calendarDate.getUTCDate() - daysSinceMonday);

  return {
    todayStart,
    weekStart: toAppLocalBoundaryUtc(
      weekStartCalendarDate.getUTCFullYear(),
      weekStartCalendarDate.getUTCMonth() + 1,
      weekStartCalendarDate.getUTCDate()
    ),
    monthStart: toAppLocalBoundaryUtc(year, month, 1),
    yearStart: toAppLocalBoundaryUtc(year, 1, 1)
  };
}

function getAppDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .formatToParts(value)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

function toAppLocalBoundaryUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - NEPAL_OFFSET_MINUTES * 60 * 1000);
}
