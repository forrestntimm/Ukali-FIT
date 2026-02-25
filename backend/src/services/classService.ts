import { ClassStatus } from "@prisma/client";
import { prisma } from "../utils/prisma";

export async function createClass(data: { title: string; datetime: Date; capacity: number }) {
  return prisma.class.create({ data });
}

export async function listUpcomingClasses() {
  return prisma.class.findMany({
    where: { datetime: { gte: new Date() } },
    orderBy: { datetime: "asc" },
    include: { signups: true }
  });
}

export async function updateClassStatus(id: string, status: ClassStatus) {
  return prisma.class.update({ where: { id }, data: { status } });
}

export async function signUpForClass(userId: string, classId: string) {
  const klass = await prisma.class.findUnique({ where: { id: classId }, include: { signups: true } });
  if (!klass) {
    const err = new Error("Class not found") as Error & { status?: number; code?: string };
    err.status = 404;
    err.code = "CLASS_NOT_FOUND";
    throw err;
  }
  if (klass.status !== ClassStatus.OPEN) {
    const err = new Error("Class is not open") as Error & { status?: number; code?: string };
    err.status = 409;
    err.code = "CLASS_NOT_OPEN";
    throw err;
  }
  if (klass.signups.length >= klass.capacity) {
    const err = new Error("Class is full") as Error & { status?: number; code?: string };
    err.status = 409;
    err.code = "CLASS_FULL";
    throw err;
  }

  try {
    return await prisma.classSignup.create({ data: { userId, classId } });
  } catch {
    const err = new Error("You are already signed up for this class") as Error & { status?: number; code?: string };
    err.status = 409;
    err.code = "CLASS_ALREADY_SIGNED_UP";
    throw err;
  }
}

export async function listClassSignups(classId: string) {
  return prisma.classSignup.findMany({
    where: { classId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } }
  });
}

type CheckInResultStatus = "CHECKED_IN" | "ALREADY_CHECKED_IN";

export async function checkInMemberForClass(
  classId: string,
  qrCode: string
): Promise<{
  status: CheckInResultStatus;
  checkInAt: Date;
  klass: { id: string; title: string; datetime: Date };
  member: { id: string; name: string; email: string; checkInQrCode: string };
}> {
  const normalizedCode = qrCode.trim();
  if (!normalizedCode) {
    const err = new Error("QR code is required") as Error & { status?: number; code?: string };
    err.status = 400;
    err.code = "CHECKIN_QR_REQUIRED";
    throw err;
  }

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, title: true, datetime: true, status: true }
  });
  if (!klass) {
    const err = new Error("Class not found") as Error & { status?: number; code?: string };
    err.status = 404;
    err.code = "CLASS_NOT_FOUND";
    throw err;
  }
  if (klass.status === ClassStatus.CANCELED) {
    const err = new Error("Class is canceled") as Error & { status?: number; code?: string };
    err.status = 409;
    err.code = "CLASS_CANCELED";
    throw err;
  }

  const member = await prisma.user.findUnique({
    where: { checkInQrCode: normalizedCode },
    select: { id: true, name: true, email: true, checkInQrCode: true }
  });
  if (!member) {
    const err = new Error("Member not found for this QR code") as Error & { status?: number; code?: string };
    err.status = 404;
    err.code = "CHECKIN_MEMBER_NOT_FOUND";
    throw err;
  }

  const signup = await prisma.classSignup.findUnique({
    where: {
      userId_classId: {
        userId: member.id,
        classId
      }
    },
    select: { id: true, checkedInAt: true }
  });

  if (!signup) {
    const err = new Error("Member is not signed up for this class") as Error & { status?: number; code?: string };
    err.status = 409;
    err.code = "CHECKIN_NO_SIGNUP";
    throw err;
  }

  if (signup.checkedInAt) {
    return {
      status: "ALREADY_CHECKED_IN",
      checkInAt: signup.checkedInAt,
      klass: { id: klass.id, title: klass.title, datetime: klass.datetime },
      member
    };
  }

  const updated = await prisma.classSignup.update({
    where: { id: signup.id },
    data: { checkedInAt: new Date() },
    select: { checkedInAt: true }
  });

  return {
    status: "CHECKED_IN",
    checkInAt: updated.checkedInAt as Date,
    klass: { id: klass.id, title: klass.title, datetime: klass.datetime },
    member
  };
}
