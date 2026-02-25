import { prisma } from "../utils/prisma";

export async function upsertWorkout(date: Date, description: string) {
  return prisma.workout.upsert({
    where: { date },
    update: { description },
    create: { date, description }
  });
}

export async function getWorkoutByDate(date: Date) {
  return prisma.workout.findUnique({ where: { date } });
}

export async function listWorkouts(from?: Date, to?: Date) {
  return prisma.workout.findMany({
    where: {
      date: {
        gte: from,
        lte: to
      }
    },
    orderBy: { date: "asc" }
  });
}

export async function deleteWorkout(id: string) {
  return prisma.workout.delete({ where: { id } });
}
