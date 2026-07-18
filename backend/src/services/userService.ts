import bcrypt from "bcryptjs";
import { PaymentMethod, PaymentStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../utils/prisma";

const userMetricsSelect = {
  id: true,
  name: true,
  profileImageDataUrl: true,
  age: true,
  fitnessGoals: true,
  personalRecords: true,
  email: true,
  phone: true,
  checkInQrCode: true,
  role: true,
  membershipStart: true,
  nextPaymentDue: true,
  paymentStatus: true,
  paymentMethod: true,
  inviteSentAt: true,
  inviteAcceptedAt: true,
  lastLoginAt: true,
  webAccessApproved: true,
  webAccessApprovedAt: true,
  webAccessApprovedById: true,
  webAccessApprovedBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  createdAt: true,
  classSignups: {
    select: {
      checkedInAt: true,
      class: {
        select: {
          datetime: true,
          status: true
        }
      }
    }
  }
} as const;

// Admin member lists never render profile photos; excluding the base64 image
// keeps the /users payload from ballooning by ~750KB per member.
const { profileImageDataUrl: _omitProfileImage, ...userListMetricsSelect } = userMetricsSelect;

const realAthleteProfileWhere: Prisma.UserWhereInput = {
  role: Role.MEMBER,
  OR: [{ inviteAcceptedAt: { not: null } }, { lastLoginAt: { not: null } }]
};

export async function createUser(input: {
  name: string;
  profileImageDataUrl?: string | null;
  age?: number;
  fitnessGoals?: string;
  email: string;
  phone?: string;
  role?: Role;
  password?: string;
  membershipStart?: Date;
  nextPaymentDue?: Date;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
}) {
  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;
  const user = await prisma.user.create({
    data: {
      name: input.name,
      profileImageDataUrl: input.profileImageDataUrl ?? null,
      age: input.age,
      fitnessGoals: input.fitnessGoals,
      email: input.email.toLowerCase(),
      phone: input.phone,
      role: input.role || Role.MEMBER,
      passwordHash,
      membershipStart: input.membershipStart,
      nextPaymentDue: input.nextPaymentDue,
      paymentStatus: input.paymentStatus || PaymentStatus.UNPAID,
      paymentMethod: input.paymentMethod
    },
    select: userMetricsSelect
  });
  return withMembershipStatusAndProfileMetrics(user);
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: userListMetricsSelect
  });

  return users.map(withMembershipStatusAndProfileMetrics);
}

export async function listCoachUsers() {
  return prisma.user.findMany({
    where: { role: Role.ADMIN },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });
}

export async function listMemberOptions() {
  return prisma.user.findMany({
    where: realAthleteProfileWhere,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      paymentStatus: true,
      inviteAcceptedAt: true,
      lastLoginAt: true
    }
  });
}

export async function getMemberDashboardStats() {
  const activityBuckets = buildActivityBuckets(8);
  const bucketsByDateKey = new Map(activityBuckets.map((bucket) => [bucket.dateKey, bucket]));
  const activityFrom = new Date(`${activityBuckets[0].dateKey}T00:00:00.000Z`);
  const activityTo = addUtcDays(new Date(`${activityBuckets[activityBuckets.length - 1].dateKey}T00:00:00.000Z`), 1);
  const renewalWindowEnd = addUtcDays(new Date(), 14);

  const [
    members,
    overdue,
    upcoming,
    activeCoaches,
    totalCheckIns,
    totalWorkoutLogs,
    totalCoachSessions,
    scheduledClasses,
    recentCheckIns,
    recentWorkoutLogs,
    recentCoachSessions,
    recentClasses
  ] = await Promise.all([
    prisma.user.count({
      where: realAthleteProfileWhere
    }),
    prisma.user.count({
      where: {
        ...realAthleteProfileWhere,
        paymentStatus: PaymentStatus.UNPAID
      }
    }),
    prisma.user.count({
      where: {
        ...realAthleteProfileWhere,
        paymentStatus: PaymentStatus.PAID,
        nextPaymentDue: {
          gte: new Date(),
          lte: renewalWindowEnd
        }
      }
    }),
    prisma.user.count({
      where: { role: Role.ADMIN }
    }),
    prisma.classSignup.count({
      where: { checkedInAt: { not: null } }
    }),
    prisma.workoutLog.count(),
    prisma.coachClassSession.count(),
    prisma.class.count({
      where: {
        datetime: { gte: new Date() },
        status: { not: "CANCELED" }
      }
    }),
    prisma.classSignup.findMany({
      where: {
        checkedInAt: {
          gte: activityFrom,
          lt: activityTo
        }
      },
      select: { checkedInAt: true }
    }),
    prisma.workoutLog.findMany({
      where: {
        checkedInAt: {
          gte: activityFrom,
          lt: activityTo
        }
      },
      select: { checkedInAt: true }
    }),
    prisma.coachClassSession.findMany({
      where: {
        createdAt: {
          gte: activityFrom,
          lt: activityTo
        }
      },
      select: { createdAt: true }
    }),
    prisma.class.findMany({
      where: {
        datetime: {
          gte: activityFrom,
          lt: activityTo
        },
        status: { not: "CANCELED" }
      },
      select: { datetime: true }
    })
  ]);

  for (const checkIn of recentCheckIns) {
    if (checkIn.checkedInAt) incrementBucket(bucketsByDateKey, checkIn.checkedInAt, "athleteCheckIns");
  }
  for (const log of recentWorkoutLogs) {
    incrementBucket(bucketsByDateKey, log.checkedInAt, "workoutLogs");
  }
  for (const session of recentCoachSessions) {
    incrementBucket(bucketsByDateKey, session.createdAt, "coachSessions");
  }
  for (const klass of recentClasses) {
    incrementBucket(bucketsByDateKey, klass.datetime, "scheduledClasses");
  }

  const activity = activityBuckets.map((bucket) => ({
    ...bucket,
    total: bucket.athleteCheckIns + bucket.workoutLogs + bucket.coachSessions + bucket.scheduledClasses
  }));

  return {
    members,
    overdue,
    upcoming,
    activeCoaches,
    totalCheckIns,
    totalWorkoutLogs,
    totalCoachSessions,
    scheduledClasses,
    activity
  };
}

export async function updateUser(id: string, data: {
  name?: string;
  profileImageDataUrl?: string | null;
  age?: number | null;
  fitnessGoals?: string | null;
  personalRecords?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  email?: string;
  phone?: string;
  membershipStart?: Date | null;
  nextPaymentDue?: Date | null;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
}) {
  const normalized: Prisma.UserUpdateInput = {};

  if (data.name !== undefined) normalized.name = data.name;
  if (data.profileImageDataUrl !== undefined) normalized.profileImageDataUrl = data.profileImageDataUrl;
  if (data.age !== undefined) normalized.age = data.age;
  if (data.fitnessGoals !== undefined) normalized.fitnessGoals = data.fitnessGoals;
  if (data.personalRecords !== undefined) normalized.personalRecords = data.personalRecords;
  if (data.email !== undefined) normalized.email = data.email.toLowerCase();
  if (data.phone !== undefined) normalized.phone = data.phone;
  if (data.membershipStart !== undefined) normalized.membershipStart = data.membershipStart;
  if (data.nextPaymentDue !== undefined) normalized.nextPaymentDue = data.nextPaymentDue;
  if (data.paymentStatus !== undefined) normalized.paymentStatus = data.paymentStatus;
  if (data.paymentMethod !== undefined) normalized.paymentMethod = data.paymentMethod;

  const user = await prisma.user.update({
    where: { id },
    data: normalized,
    select: userMetricsSelect
  });
  return withMembershipStatusAndProfileMetrics(user);
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userMetricsSelect
  });
  return user ? withMembershipStatusAndProfileMetrics(user) : null;
}

export async function getUserAuthIdentityById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      supabaseUserId: true
    }
  });
}

export function withMembershipStatus(user: {
  nextPaymentDue: Date | null;
  paymentStatus: PaymentStatus;
  [key: string]: any;
}) {
  const now = new Date();
  const active = user.paymentStatus === PaymentStatus.PAID && user.nextPaymentDue && user.nextPaymentDue >= now;
  return { ...user, membershipStatus: active ? "ACTIVE" : "EXPIRED" };
}

export type SignupWithClass = {
  checkedInAt: Date | null;
  class: {
    datetime: Date;
    status: "OPEN" | "CLOSED" | "CANCELED";
  };
};

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isGymWeekday(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function previousGymDay(date: Date) {
  const cursor = new Date(date);
  cursor.setDate(cursor.getDate() - 1);
  while (!isGymWeekday(cursor)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  return cursor;
}

export function calculateCurrentWorkoutStreak(signups: SignupWithClass[]) {
  const eligibleDates = signups
    .filter(
      (signup) =>
        signup.checkedInAt !== null &&
        signup.class.status !== "CANCELED" &&
        signup.class.datetime <= new Date() &&
        isGymWeekday(signup.class.datetime)
    )
    .map((signup) => toDateKey(signup.class.datetime));
  const uniqueDays = Array.from(new Set(eligibleDates)).sort();
  if (uniqueDays.length === 0) return 0;

  let streak = 1;
  const daySet = new Set(uniqueDays);
  let cursor = previousGymDay(new Date(uniqueDays[uniqueDays.length - 1]));
  while (daySet.has(toDateKey(cursor))) {
    streak += 1;
    cursor = previousGymDay(cursor);
  }
  return streak;
}

function calculateDaysLeftInMembership(nextPaymentDue: Date | null, paymentStatus: PaymentStatus) {
  if (!nextPaymentDue || paymentStatus !== PaymentStatus.PAID) return 0;
  const diffMs = nextPaymentDue.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function withMembershipStatusAndProfileMetrics(user: {
  classSignups: SignupWithClass[];
  nextPaymentDue: Date | null;
  paymentStatus: PaymentStatus;
  [key: string]: any;
}) {
  const attendedClassSignups = user.classSignups.filter(
    (signup) => signup.class.status !== "CANCELED" && signup.checkedInAt !== null
  );
  const { classSignups, ...rest } = user;
  const enriched = withMembershipStatus(rest);
  return {
    ...enriched,
    classesTotalAttended: attendedClassSignups.length,
    workoutStreak: calculateCurrentWorkoutStreak(classSignups),
    daysLeftInMembership: calculateDaysLeftInMembership(rest.nextPaymentDue, rest.paymentStatus)
  };
}

function startOfUtcDay(date: Date) {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatShortDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function buildActivityBuckets(dayCount: number) {
  const today = startOfUtcDay(new Date());
  return Array.from({ length: dayCount }, (_, index) => {
    const date = addUtcDays(today, index - (dayCount - 1));
    const dateKey = toDateKey(date);
    return {
      dateKey,
      label: formatShortDateLabel(date),
      athleteCheckIns: 0,
      workoutLogs: 0,
      coachSessions: 0,
      scheduledClasses: 0,
      total: 0
    };
  });
}

function incrementBucket<T extends { [key: string]: any }>(
  bucketsByDateKey: Map<string, T>,
  date: Date,
  key: keyof T
) {
  const bucket = bucketsByDateKey.get(toDateKey(date));
  if (!bucket) return;
  const current = Number(bucket[key] || 0);
  bucket[key] = (current + 1) as T[keyof T];
}

export async function getUserForAuthByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      role: true,
      supabaseUserId: true,
      webAccessApproved: true
    }
  });
}

export async function getUserForAuthBySupabaseId(supabaseUserId: string) {
  return prisma.user.findUnique({
    where: { supabaseUserId },
    select: {
      id: true,
      email: true,
      role: true,
      supabaseUserId: true,
      webAccessApproved: true
    }
  });
}

export async function linkSupabaseUser(userId: string, supabaseUserId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      supabaseUserId
    }
  });
}

export async function markInviteSent(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { inviteSentAt: new Date() }
  });
}

export async function markAuthSuccess(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      inviteAcceptedAt: new Date(),
      lastLoginAt: new Date()
    }
  });
}

export async function listWorkoutLogsByUser(userId: string) {
  return prisma.workoutLog.findMany({
    where: { userId },
    orderBy: { checkedInAt: "desc" },
    select: {
      id: true,
      checkedInAt: true,
      weight: true,
      completionTime: true,
      movementScales: true,
      coachNotes: true,
      class: {
        select: {
          id: true,
          title: true,
          datetime: true
        }
      },
      workout: {
        select: {
          id: true,
          date: true,
          description: true
        }
      }
    }
  });
}

export async function countClassesCoachedByUser(userId: string) {
  return prisma.coachClassSession.count({
    where: { coachId: userId }
  });
}

export async function approveUserWebAccess(targetUserId: string, approverUserId: string) {
  return prisma.user.update({
    where: { id: targetUserId },
    data: {
      webAccessApproved: true,
      webAccessApprovedAt: new Date(),
      webAccessApprovedById: approverUserId
    },
    select: {
      id: true,
      email: true,
      webAccessApproved: true,
      webAccessApprovedAt: true,
      webAccessApprovedById: true
    }
  });
}
