import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import { checkInMemberForClass, createClass, listUpcomingClasses, listClassSignups, signUpForClass, updateClassStatus } from "../services/classService";

const router = Router();

const createSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    datetime: z.string().datetime(),
    capacity: z.number().int().min(1)
  })
});

const statusSchema = z.object({
  body: z.object({
    status: z.enum(["OPEN", "CLOSED", "CANCELED"])
  })
});

const checkInSchema = z.object({
  body: z.object({
    qrCode: z.string().min(1)
  })
});

router.get("/", requireAuth, async (_req, res) => {
  const classes = await listUpcomingClasses();
  return res.json(classes);
});

router.post("/", requireAuth, requireRole("ADMIN"), validate(createSchema), async (req, res) => {
  const { title, datetime, capacity } = req.body;
  const klass = await createClass({ title, datetime: new Date(datetime), capacity });
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

router.post("/:id/checkin", requireAuth, requireRole("ADMIN"), validate(checkInSchema), async (req, res) => {
  try {
    const result = await checkInMemberForClass(req.params.id, req.body.qrCode);
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

export default router;
