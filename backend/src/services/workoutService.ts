import { prisma } from "../utils/prisma";
import { clearResponseCache, readResponseCache, writeResponseCache } from "../utils/responseCache";

export async function upsertWorkout(date: Date, description: string) {
  const workout = await prisma.workout.upsert({
    where: { date },
    update: { description },
    create: { date, description }
  });
  clearResponseCache("workouts:");
  return workout;
}

export async function getWorkoutByDate(date: Date) {
  const cacheKey = `workouts:date:${date.toISOString()}`;
  const cached = readResponseCache<Awaited<ReturnType<typeof prisma.workout.findUnique>>>(cacheKey);
  if (cached !== undefined) return cached;

  const workout = await prisma.workout.findUnique({ where: { date } });
  return writeResponseCache(cacheKey, workout, 60 * 1000);
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
  const deleted = await prisma.workout.delete({ where: { id } });
  clearResponseCache("workouts:");
  return deleted;
}
