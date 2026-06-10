import { ClassStatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { logger } from "../utils/logger";
import { isBlockedClassTime, removeBlockedClassTimes } from "../utils/classTimeRules";
import { normalizeCheckInQrCode } from "./checkInQr";
import { sendCoachScheduleNotification } from "./notificationService";

const APP_TIME_ZONE = "Asia/Kathmandu";

function toUtcMidnight(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function resolveAppDayStart() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return toUtcMidnight(year, month, day);
}

async function assertCoachExists(coachId: string) {
  const coach = await prisma.user.findUnique({
    where: { id: coachId },
    select: { id: true, role: true, name: true, email: true }
  });
  if (!coach || coach.role !== "ADMIN") {
    const err = new Error("Assigned coach was not found") as Error & { status?: number; code?: string };
    err.status = 404;
    err.code = "CLASS_COACH_NOT_FOUND";
    throw err;
  }
}

async function assertOptionalCoachExists(coachId?: string | null) {
  if (!coachId) return;
  await assertCoachExists(coachId);
}

export async function createClass(data: { title: string; datetime: Date; capacity: number; coachId: string }) {
  if (isBlockedClassTime(data.datetime)) {
    const err = new Error("5:00 PM classes are disabled.") as Error & { status?: number; code?: string };
    err.status = 400;
    err.code = "CLASS_TIME_BLOCKED";
    throw err;
  }

  await assertCoachExists(data.coachId);
  const klass = await prisma.class.create({ data });

  void sendCoachScheduleNotification({
    coachId: data.coachId,
    classId: klass.id,
    classTitle: klass.title,
    classDateTime: klass.datetime
  }).catch((err) => {
    logger.error({ err, classId: klass.id, coachId: data.coachId }, "Failed to send coach schedule notification");
  });

  return klass;
}

export async function listUpcomingClasses(args?: { coachId?: string; from?: Date; to?: Date }) {
  const coachId = args?.coachId;
  const from = args?.from;
  const to = args?.to;
  const classes = await prisma.class.findMany({
    where: {
      datetime: {
        gte: from || new Date(),
        lte: to || undefined
      },
      coachId: coachId || undefined
    },
    orderBy: { datetime: "asc" },
    include: {
      signups: {
        select: {
          id: true,
          userId: true,
          checkedInAt: true
        }
      },
      coach: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      secondaryCoach: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  return removeBlockedClassTimes(classes);
}

export async function listAssignedClassSummaries(args: { coachId: string; from?: Date; to?: Date; limit?: number }) {
  const from = args.from;
  const to = args.to;
  const limit = Math.max(1, Math.min(args.limit ?? 20, 50));

  const classes = await prisma.class.findMany({
    where: {
      datetime: {
        gte: from || resolveAppDayStart(),
        lte: to || undefined
      },
      OR: [{ coachId: args.coachId }, { secondaryCoachId: args.coachId }]
    },
    take: limit,
    orderBy: { datetime: "asc" },
    select: {
      id: true,
      title: true,
      datetime: true,
      capacity: true,
      status: true,
      coachId: true,
      secondaryCoachId: true,
      _count: {
        select: {
          signups: true
        }
      }
    }
  });

  const visibleClasses = removeBlockedClassTimes(classes);

  if (visibleClasses.length === 0) {
    return [];
  }

  const checkedInCounts = await prisma.classSignup.groupBy({
    by: ["classId"],
    where: {
      classId: {
        in: visibleClasses.map((klass) => klass.id)
      },
      checkedInAt: {
        not: null
      }
    },
    _count: {
      classId: true
    }
  });

  const checkedInCountByClassId = new Map(
    checkedInCounts.map((entry) => [entry.classId, entry._count.classId])
  );

  return visibleClasses.map((klass) => ({
    id: klass.id,
    title: klass.title,
    datetime: klass.datetime,
    capacity: klass.capacity,
    status: klass.status,
    coachAssignmentRole: klass.secondaryCoachId === args.coachId ? "SECONDARY" : "PRIMARY",
    reservationCount: klass._count.signups,
    checkedInCount: checkedInCountByClassId.get(klass.id) || 0
  }));
}

export async function listUpcomingClassSummaries(args?: { from?: Date; to?: Date; limit?: number }) {
  const from = args?.from;
  const to = args?.to;
  const limit = Math.max(1, Math.min(args?.limit ?? 5, 20));

  const classes = await prisma.class.findMany({
    where: {
      datetime: {
        gte: from || resolveAppDayStart(),
        lte: to || undefined
      },
      status: ClassStatus.OPEN
    },
    take: limit,
    orderBy: { datetime: "asc" },
    select: {
      id: true,
      title: true,
      datetime: true,
      capacity: true,
      status: true
    }
  });

  return removeBlockedClassTimes(classes).slice(0, limit);
}

export async function getWorkoutForClass(classId: string) {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      datetime: true
    }
  });

  if (!klass) {
    const err = new Error("Class was not found") as Error & { status?: number; code?: string };
    err.status = 404;
    err.code = "CLASS_NOT_FOUND";
    throw err;
  }

  return findWorkoutForClassDate(klass.datetime);
}

export async function listSchedulingClasses(args?: { from?: Date; to?: Date }) {
  const from = args?.from;
  const to = args?.to;

  const classes = await prisma.class.findMany({
    where: {
      datetime: {
        gte: from || new Date(),
        lte: to || undefined
      }
    },
    orderBy: { datetime: "asc" },
    select: {
      id: true,
      title: true,
      datetime: true,
      capacity: true,
      status: true,
      coachId: true,
      secondaryCoachId: true,
      coach: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      secondaryCoach: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  return removeBlockedClassTimes(classes);
}

export async function updateClassStatus(id: string, status: ClassStatus) {
  return prisma.class.update({ where: { id }, data: { status } });
}

export async function assignClassCoach(id: string, coachId: string) {
  const existing = await prisma.class.findUnique({
    where: { id },
    select: { id: true, coachId: true }
  });
  if (!existing) {
    const err = new Error("Class not found") as Error & { status?: number; code?: string };
    err.status = 404;
    err.code = "CLASS_NOT_FOUND";
    throw err;
  }

  await assertCoachExists(coachId);
  const updated = await prisma.class.update({
    where: { id },
    data: { coachId },
    include: {
      coach: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  if (existing.coachId !== coachId) {
    void sendCoachScheduleNotification({
      coachId,
      classId: updated.id,
      classTitle: updated.title,
      classDateTime: updated.datetime
    }).catch((err) => {
      logger.error({ err, classId: updated.id, coachId }, "Failed to send coach reassignment notification");
    });
  }

  return updated;
}

export async function assignClassCoaches(
  id: string,
  input: { primaryCoachId?: string | null; secondaryCoachId?: string | null }
) {
  const existing = await prisma.class.findUnique({
    where: { id },
    select: { id: true, coachId: true, secondaryCoachId: true, title: true, datetime: true }
  });
  if (!existing) {
    const err = new Error("Class not found") as Error & { status?: number; code?: string };
    err.status = 404;
    err.code = "CLASS_NOT_FOUND";
    throw err;
  }

  const primaryCoachId = input.primaryCoachId === undefined ? existing.coachId : input.primaryCoachId;
  const secondaryCoachId =
    input.secondaryCoachId === undefined ? existing.secondaryCoachId : input.secondaryCoachId;

  if (primaryCoachId && secondaryCoachId && primaryCoachId === secondaryCoachId) {
    const err = new Error("Primary and secondary coach must be different people.") as Error & {
      status?: number;
      code?: string;
    };
    err.status = 400;
    err.code = "CLASS_DUPLICATE_COACH_ASSIGNMENT";
    throw err;
  }

  await Promise.all([assertOptionalCoachExists(primaryCoachId), assertOptionalCoachExists(secondaryCoachId)]);

  const updated = await prisma.class.update({
    where: { id },
    data: {
      coachId: primaryCoachId || null,
      secondaryCoachId: secondaryCoachId || null
    },
    include: {
      coach: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      secondaryCoach: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  if (existing.coachId !== updated.coachId && updated.coachId) {
    void sendCoachScheduleNotification({
      coachId: updated.coachId,
      classId: updated.id,
      classTitle: updated.title,
      classDateTime: updated.datetime
    }).catch((err) => {
      logger.error({ err, classId: updated.id, coachId: updated.coachId }, "Failed to send coach reassignment notification");
    });
  }

  return updated;
}

export async function signUpForClass(userId: string, classId: string) {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      status: true,
      capacity: true,
      signups: {
        select: {
          id: true
        }
      }
    }
  });
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
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          paymentStatus: true,
          checkInQrCode: true
        }
      }
    }
  });
}

type CheckInResultStatus = "CHECKED_IN" | "ALREADY_CHECKED_IN";

type WorkoutPerformanceInput = {
  weight?: string;
  completionTime?: string;
  movementScales?: string;
  coachNotes?: string;
};

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePerformanceInput(input?: WorkoutPerformanceInput) {
  return {
    weight: normalizeOptionalText(input?.weight),
    completionTime: normalizeOptionalText(input?.completionTime),
    movementScales: normalizeOptionalText(input?.movementScales),
    coachNotes: normalizeOptionalText(input?.coachNotes)
  };
}

function getUtcDayBounds(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start, end };
}

async function findWorkoutForClassDate(classDateTime: Date) {
  const { start, end } = getUtcDayBounds(classDateTime);
  return prisma.workout.findFirst({
    where: {
      date: {
        gte: start,
        lt: end
      }
    },
    orderBy: { date: "asc" }
  });
}

async function upsertWorkoutLogForCheckIn(args: {
  userId: string;
  classId: string;
  checkedInAt: Date;
  classDateTime: Date;
  performance?: WorkoutPerformanceInput;
}) {
  const { userId, classId, checkedInAt, classDateTime, performance } = args;
  const workout = await findWorkoutForClassDate(classDateTime);
  const normalized = normalizePerformanceInput(performance);

  const updateData: {
    checkedInAt: Date;
    weight?: string;
    completionTime?: string;
    movementScales?: string;
    coachNotes?: string;
    workoutId?: string;
  } = {
    checkedInAt,
    ...normalized
  };

  if (workout?.id) {
    updateData.workoutId = workout.id;
  }

  return prisma.workoutLog.upsert({
    where: {
      userId_classId: {
        userId,
        classId
      }
    },
    update: updateData,
    create: {
      userId,
      classId,
      checkedInAt,
      workoutId: workout?.id,
      ...normalized
    },
    select: {
      id: true,
      checkedInAt: true,
      weight: true,
      completionTime: true,
      movementScales: true,
      coachNotes: true,
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

async function upsertCoachClassSession(coachId: string | undefined, classId: string) {
  if (!coachId) return;

  await prisma.coachClassSession.upsert({
    where: {
      coachId_classId: {
        coachId,
        classId
      }
    },
    update: {},
    create: {
      coachId,
      classId
    }
  });
}

export async function checkInMemberForClass(
  classId: string,
  qrCode: string,
  performance?: WorkoutPerformanceInput,
  actorCoachId?: string
): Promise<{
  status: CheckInResultStatus;
  checkInAt: Date;
  klass: { id: string; title: string; datetime: Date };
  member: { id: string; name: string; email: string; checkInQrCode: string };
  workoutLog: {
    id: string;
    checkedInAt: Date;
    weight: string | null;
    completionTime: string | null;
    movementScales: string | null;
    coachNotes: string | null;
    workout: {
      id: string;
      date: Date;
      description: string;
    } | null;
  };
}> {
  const normalizedCode = normalizeCheckInQrCode(qrCode);
  if (!normalizedCode) {
    const err = new Error("QR code is required") as Error & { status?: number; code?: string };
    err.status = 400;
    err.code = "CHECKIN_QR_REQUIRED";
    throw err;
  }

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, title: true, datetime: true, status: true, coachId: true }
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
  if (!klass.coachId) {
    const err = new Error("Class has no assigned coach yet") as Error & { status?: number; code?: string };
    err.status = 409;
    err.code = "CLASS_COACH_NOT_ASSIGNED";
    throw err;
  }
  if (actorCoachId && klass.coachId !== actorCoachId) {
    const err = new Error("You are not assigned to coach this class") as Error & { status?: number; code?: string };
    err.status = 403;
    err.code = "CLASS_COACH_MISMATCH";
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
    await upsertCoachClassSession(actorCoachId, classId);
    const workoutLog = await upsertWorkoutLogForCheckIn({
      userId: member.id,
      classId,
      checkedInAt: signup.checkedInAt,
      classDateTime: klass.datetime,
      performance
    });

    return {
      status: "ALREADY_CHECKED_IN",
      checkInAt: signup.checkedInAt,
      klass: { id: klass.id, title: klass.title, datetime: klass.datetime },
      member,
      workoutLog
    };
  }

  const updated = await prisma.classSignup.update({
    where: { id: signup.id },
    data: { checkedInAt: new Date() },
    select: { checkedInAt: true }
  });

  const checkInAt = updated.checkedInAt as Date;
  await upsertCoachClassSession(actorCoachId, classId);
  const workoutLog = await upsertWorkoutLogForCheckIn({
    userId: member.id,
    classId,
    checkedInAt: checkInAt,
    classDateTime: klass.datetime,
    performance
  });

  return {
    status: "CHECKED_IN",
    checkInAt,
    klass: { id: klass.id, title: klass.title, datetime: klass.datetime },
    member,
    workoutLog
  };
}
