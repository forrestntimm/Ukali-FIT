import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import { getWorkoutByDate, listWorkouts, upsertWorkout, deleteWorkout } from "../services/workoutService";

const router = Router();

const upsertSchema = z.object({
  body: z.object({
    date: z.string().datetime(),
    description: z.string().min(2)
  })
});

router.get("/today", requireAuth, async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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
  const workout = await upsertWorkout(new Date(date), description);
  return res.status(201).json(workout);
});

router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  await deleteWorkout(req.params.id);
  return res.status(204).send();
});

export default router;
