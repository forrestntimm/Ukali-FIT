import { Router } from "express";
import auth from "./auth";
import users from "./users";
import payments from "./payments";
import workouts from "./workouts";
import classes from "./classes";
import announcements from "./announcements";
import devices from "./devices";
import webhooks from "./webhooks";

const router = Router();

router.use("/auth", auth);
router.use("/users", users);
router.use("/payments", payments);
router.use("/workouts", workouts);
router.use("/classes", classes);
router.use("/announcements", announcements);
router.use("/devices", devices);
router.use("/webhooks", webhooks);

export default router;
