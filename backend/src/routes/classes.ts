import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import {
  assignClassCoach,
  checkInMemberForClass,
  createClass,
  getWorkoutForClass,
  listAssignedClassSummaries,
  listUpcomingClassSummaries,
  listUpcomingClasses,
  listClassSignups,
  signUpForClass,
  updateClassStatus
} from "../services/classService";

const router = Router();

const createSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    datetime: z.string().datetime(),
    capacity: z.number().int().min(1),
    coachId: z.string().uuid()
  })
});

const statusSchema = z.object({
  body: z.object({
    status: z.enum(["OPEN", "CLOSED", "CANCELED"])
  })
});

const assignCoachSchema = z.object({
  body: z.object({
    coachId: z.string().uuid()
  })
});

const checkInSchema = z.object({
  body: z.object({
    qrCode: z.string().min(1),
    weight: z.string().max(40).optional(),
    completionTime: z.string().max(40).optional(),
    movementScales: z.string().max(500).optional(),
    coachNotes: z.string().max(1000).optional()
  })
});

router.get("/", requireAuth, async (req, res) => {
  const mine = req.query.mine === "true";
  const summary = req.query.summary === "true";
  const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
  const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
  const queryCoachId = typeof req.query.coachId === "string" ? req.query.coachId : undefined;
  const coachId = mine ? req.user!.id : queryCoachId;
  if (mine && summary && coachId) {
    const classes = await listAssignedClassSummaries({ coachId, limit });
    return res.json(classes);
  }
  if (summary) {
    const classes = await listUpcomingClassSummaries({ limit });
    return res.json(classes);
  }
  const classes = await listUpcomingClasses({ coachId, from, to, limit });
  return res.json(classes);
});

router.post("/", requireAuth, requireRole("ADMIN"), validate(createSchema), async (req, res) => {
  const { title, datetime, capacity, coachId } = req.body;
  const klass = await createClass({ title, datetime: new Date(datetime), capacity, coachId });
  return res.status(201).json(klass);
});

router.post("/:id/signup", requireAuth, async (req, res) => {
  try {
    const signup = await signUpForClass(req.user!.id, req.params.id);
    return res.status(201).json(signup);
  } catch (err: any) {
    return res.status(err?.status || 400).json({
      code: err?.code || "CLASS_SIGNUP_FAILED",
      message: err?.message || "Failed to sign up for class"
    });
  }
});

router.get("/:id/signups", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const signups = await listClassSignups(req.params.id);
  return res.json(signups);
});

router.get("/:id/workout", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const workout = await getWorkoutForClass(req.params.id);
  return res.json(workout);
});

router.post("/:id/checkin", requireAuth, requireRole("ADMIN"), validate(checkInSchema), async (req, res) => {
  try {
    const { qrCode, weight, completionTime, movementScales, coachNotes } = req.body;
    const result = await checkInMemberForClass(req.params.id, qrCode, {
      weight,
      completionTime,
      movementScales,
      coachNotes
    }, req.user!.id);
    return res.json(result);
  } catch (err: any) {
    return res.status(err?.status || 400).json({
      code: err?.code || "CLASS_CHECKIN_FAILED",
      message: err?.message || "Failed to check in member"
    });
  }
});

router.patch("/:id/status", requireAuth, requireRole("ADMIN"), validate(statusSchema), async (req, res) => {
  const updated = await updateClassStatus(req.params.id, req.body.status);
  return res.json(updated);
});

router.patch("/:id/coach", requireAuth, requireRole("ADMIN"), validate(assignCoachSchema), async (req, res) => {
  const updated = await assignClassCoach(req.params.id, req.body.coachId);
  return res.json(updated);
});

export default router;
