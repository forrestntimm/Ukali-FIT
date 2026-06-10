import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import { getWorkoutByDate, listWorkouts, upsertWorkout, deleteWorkout } from "../services/workoutService";
import { sendWeeklyWorkoutsUploadedNotification } from "../services/notificationService";
import { logger } from "../utils/logger";

const router = Router();
const APP_TIME_ZONE = "Asia/Kathmandu";

function toUtcMidnight(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function parseWorkoutDateInput(input: string): Date | null {
  const trimmed = input.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const normalized = toUtcMidnight(year, month, day);
    return Number.isNaN(normalized.getTime()) ? null : normalized;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toUtcMidnight(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
}

function resolveTodayForTimeZone(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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

function resolveRequestTimeZone(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return APP_TIME_ZONE;
  }

  const candidate = value.trim();
  try {
    new Intl.DateTimeFormat("en-CA", {
      timeZone: candidate,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    return candidate;
  } catch {
    return APP_TIME_ZONE;
  }
}

function getUtcWeekStartMonday(date: Date) {
  const dayOfWeek = date.getUTCDay(); // 0 = Sun, 1 = Mon
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

async function notifyCoachesIfWeekUploaded(workoutDate: Date) {
  const weekStart = getUtcWeekStartMonday(workoutDate);
  const weekEndDay = new Date(weekStart);
  weekEndDay.setUTCDate(weekStart.getUTCDate() + 6);
  weekEndDay.setUTCHours(0, 0, 0, 0);

  const weekQueryEnd = new Date(weekEndDay);
  weekQueryEnd.setUTCHours(23, 59, 59, 999);

  const workoutsForWeek = await listWorkouts(weekStart, weekQueryEnd);
  const uniqueWorkoutDays = new Set(workoutsForWeek.map((item) => item.date.toISOString().slice(0, 10)));
  if (uniqueWorkoutDays.size !== 7) return;

  await sendWeeklyWorkoutsUploadedNotification({
    weekStart,
    weekEnd: weekEndDay
  });
}

const upsertSchema = z.object({
  body: z.object({
    date: z.string().min(1),
    description: z.string().min(2)
  })
});

router.get("/today", requireAuth, async (req, res) => {
  const timeZone = resolveRequestTimeZone(req.headers["x-ukali-time-zone"]);
  const today = resolveTodayForTimeZone(timeZone);
  const workout = await getWorkoutByDate(today);
  return res.json(workout);
});

router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { from, to } = req.query;
  const workouts = await listWorkouts(
    typeof from === "string" ? new Date(from) : undefined,
    typeof to === "string" ? new Date(to) : undefined
  );
  return res.json(workouts);
});

router.post("/", requireAuth, requireRole("ADMIN"), validate(upsertSchema), async (req, res) => {
  const { date, description } = req.body;
  const parsedDate = parseWorkoutDateInput(date);
  if (!parsedDate) {
    return res.status(400).json({ code: "WORKOUT_INVALID_DATE", message: "Workout date must be a valid date." });
  }

  const existingWorkout = await getWorkoutByDate(parsedDate);
  const workout = await upsertWorkout(parsedDate, description.trim());
  if (!existingWorkout) {
    try {
      await notifyCoachesIfWeekUploaded(parsedDate);
    } catch (err) {
      logger.error({ err, date: parsedDate.toISOString() }, "Failed to send weekly workouts uploaded notification");
    }
  }
  return res.status(201).json(workout);
});

router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  await deleteWorkout(req.params.id);
  return res.status(204).send();
});

export default router;
