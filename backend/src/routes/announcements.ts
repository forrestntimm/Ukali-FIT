import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import { createAnnouncement, deleteAnnouncement, listAnnouncements } from "../services/announcementService";
import { sendAnnouncementNotification } from "../services/notificationService";

const router = Router();

const createSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    body: z.string().min(2),
    imageUrl: z.string().url().optional()
  })
});

router.get("/", requireAuth, async (_req, res) => {
  const announcements = await listAnnouncements();
  return res.json(announcements);
});

router.post("/", requireAuth, requireRole("ADMIN"), validate(createSchema), async (req, res) => {
  const announcement = await createAnnouncement(req.body);
  await sendAnnouncementNotification({
    announcementId: announcement.id,
    title: announcement.title,
    body: announcement.body
  });
  return res.status(201).json(announcement);
});

router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  await deleteAnnouncement(req.params.id);
  return res.status(204).send();
});

export default router;
