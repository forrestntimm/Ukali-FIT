import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import { assignClassCoach, assignClassCoaches, listSchedulingClasses } from "../services/classService";

const router = Router();

const assignCoachSchema = z.object({
  body: z.object({
    coachId: z.string().uuid()
  })
});

const assignCoachesSchema = z.object({
  body: z.object({
    primaryCoachId: z.string().uuid().nullable().optional(),
    secondaryCoachId: z.string().uuid().nullable().optional()
  })
});

router.get("/classes", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  const from = typeof _req.query.from === "string" ? new Date(_req.query.from) : undefined;
  const to = typeof _req.query.to === "string" ? new Date(_req.query.to) : undefined;
  const classes = await listSchedulingClasses({ from, to });
  return res.json(classes);
});

router.patch("/classes/:id/coach", requireAuth, requireRole("ADMIN"), validate(assignCoachSchema), async (req, res) => {
  const updated = await assignClassCoach(req.params.id, req.body.coachId);
  return res.json(updated);
});

router.patch(
  "/classes/:id/coaches",
  requireAuth,
  requireRole("ADMIN"),
  validate(assignCoachesSchema),
  async (req, res) => {
    const updated = await assignClassCoaches(req.params.id, req.body);
    return res.json(updated);
  }
);

export default router;
