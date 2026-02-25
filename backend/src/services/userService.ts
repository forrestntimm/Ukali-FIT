import bcrypt from "bcryptjs";
import { PaymentMethod, PaymentStatus, Role } from "@prisma/client";
import { prisma } from "../utils/prisma";

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
    select: {
      id: true,
      name: true,
      profileImageDataUrl: true,
      age: true,
      fitnessGoals: true,
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
    }
  });
  return withMembershipStatusAndProfileMetrics(user);
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      profileImageDataUrl: true,
      age: true,
      fitnessGoals: true,
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
    }
  });

  return users.map(withMembershipStatusAndProfileMetrics);
}

export async function updateUser(id: string, data: {
  name?: string;
  profileImageDataUrl?: string | null;
  age?: number | null;
  fitnessGoals?: string | null;
  email?: string;
  phone?: string;
  membershipStart?: Date | null;
  nextPaymentDue?: Date | null;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
}) {
  const normalized = {
    ...data,
    email: data.email ? data.email.toLowerCase() : undefined
  };
  const user = await prisma.user.update({
    where: { id },
    data: normalized,
    select: {
      id: true,
      name: true,
      profileImageDataUrl: true,
      age: true,
      fitnessGoals: true,
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
    }
  });
  return withMembershipStatusAndProfileMetrics(user);
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      profileImageDataUrl: true,
      age: true,
      fitnessGoals: true,
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
    }
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

type SignupWithClass = {
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

function calculateCurrentWorkoutStreak(signups: SignupWithClass[]) {
  const eligibleDates = signups
    .filter(
      (signup) =>
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

function withMembershipStatusAndProfileMetrics(user: {
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

export async function getUserForAuthByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      role: true,
      supabaseUserId: true
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
      supabaseUserId: true
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
