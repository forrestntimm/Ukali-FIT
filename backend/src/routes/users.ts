import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { otpLimiter, passwordLimiter } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import {
  createUser,
  listCoachUsers,
  listMemberOptions,
  getMemberDashboardStats,
  listUsers,
  updateUser,
  deleteUser,
  getUserById,
  listWorkoutLogsByUser,
  countClassesCoachedByUser,
  approveUserWebAccess
} from "../services/userService";
import { prisma } from "../utils/prisma";
import { resendMagicLink, sendInviteEmail, setSupabasePasswordForLocalUser } from "../services/supabaseAuthService";
import { config, resolveAllowedCallbackUrl } from "../utils/config";

const router = Router();

const personalRecordsSchema = z
  .object({
    deadlift: z.string().max(60).nullable().optional(),
    backSquat: z.string().max(60).nullable().optional(),
    frontSquat: z.string().max(60).nullable().optional(),
    cleans: z.string().max(60).nullable().optional(),
    pushPress: z.string().max(60).nullable().optional(),
    strictPress: z.string().max(60).nullable().optional(),
    pushJerk: z.string().max(60).nullable().optional(),
    benchPress: z.string().max(60).nullable().optional(),
    oneMileRun: z.string().max(60).nullable().optional(),
    fiveKilometerRun: z.string().max(60).nullable().optional()
  })
  .optional();

function mapInviteError(message?: string) {
  const normalized = (message || "").toLowerCase();
  if (normalized.includes("rate limit")) {
    return { status: 429, code: "INVITE_RATE_LIMITED" as const };
  }
  if (normalized.includes("invalid") && normalized.includes("email")) {
    return { status: 422, code: "INVITE_EMAIL_INVALID" as const };
  }
  if (normalized.includes("already been registered")) {
    return { status: 409, code: "INVITE_ALREADY_REGISTERED" as const };
  }
  return { status: 400, code: "INVITE_FAILED" as const };
}

function shouldFallbackToInvite(message?: string) {
  const normalized = (message || "").toLowerCase();
  return (
    normalized.includes("user not found") ||
    normalized.includes("user does not exist") ||
    normalized.includes("email not found") ||
    normalized.includes("signups not allowed for otp")
  );
}

const createSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    profileImageDataUrl: z.string().max(750000).optional(),
    age: z.number().int().min(1).max(120).optional(),
    fitnessGoals: z.string().max(500).optional(),
    email: z.string().email(),
    phone: z.string().optional(),
    role: z.enum(["ADMIN", "MEMBER"]).optional(),
    password: z.string().min(6).optional(),
    membershipStart: z.string().datetime().optional(),
    nextPaymentDue: z.string().datetime().optional(),
    paymentStatus: z.enum(["PAID", "UNPAID"]).optional(),
    paymentMethod: z.enum(["PHONE_PAY", "CASH"]).optional()
  })
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    profileImageDataUrl: z.string().max(750000).nullable().optional(),
    age: z.number().int().min(1).max(120).nullable().optional(),
    fitnessGoals: z.string().max(500).nullable().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    membershipStart: z.string().datetime().nullable().optional(),
    nextPaymentDue: z.string().datetime().nullable().optional(),
    paymentStatus: z.enum(["PAID", "UNPAID"]).optional(),
    paymentMethod: z.enum(["PHONE_PAY", "CASH"]).nullable().optional()
  })
});

const inviteSchema = z.object({
  body: z.object({
    email: z.string().email(),
    name: z.string().min(2),
    profileImageDataUrl: z.string().max(750000).optional(),
    age: z.number().int().min(1).max(120).optional(),
    fitnessGoals: z.string().max(500).optional(),
    phone: z.string().optional(),
    role: z.enum(["ADMIN", "MEMBER"]).optional(),
    membershipStart: z.string().datetime().optional(),
    nextPaymentDue: z.string().datetime().optional(),
    paymentStatus: z.enum(["PAID", "UNPAID"]).optional(),
    paymentMethod: z.enum(["PHONE_PAY", "CASH"]).optional(),
    redirectTo: z.string().url().optional()
  })
});

const updateMeSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    profileImageDataUrl: z.string().max(750000).nullable().optional(),
    age: z.number().int().min(1).max(120).nullable().optional(),
    fitnessGoals: z.string().max(500).nullable().optional(),
    personalRecords: personalRecordsSchema
  })
});

const updateMyPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(8).max(72)
  })
});

router.get("/me", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const user = await getUserById(userId);
  return res.json(user);
});

router.patch("/me", requireAuth, validate(updateMeSchema), async (req, res) => {
  const userId = req.user!.id;
  const data = req.body;
  const user = await updateUser(userId, {
    name: data.name,
    profileImageDataUrl: data.profileImageDataUrl,
    age: data.age,
    fitnessGoals: data.fitnessGoals,
    personalRecords: data.personalRecords
  });
  return res.json(user);
});

router.get("/me/workout-logs", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const logs = await listWorkoutLogsByUser(userId);
  return res.json(logs);
});

router.get("/me/coach-stats", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const classesCoached = await countClassesCoachedByUser(userId);
  return res.json({ classesCoached });
});

router.post("/me/password", requireAuth, passwordLimiter, validate(updateMyPasswordSchema), async (req, res) => {
  const userId = req.user!.id;
  const { password } = req.body;
  await setSupabasePasswordForLocalUser(userId, password);
  return res.status(204).send();
});

router.get("/", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  const users = await listUsers();
  return res.json(users);
});

router.get("/member-options", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  const members = await listMemberOptions();
  return res.json(members);
});

router.get("/stats", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  const stats = await getMemberDashboardStats();
  return res.json(stats);
});

router.get("/coaches", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  const coaches = await listCoachUsers();
  return res.json(coaches);
});

router.post("/", requireAuth, requireRole("ADMIN"), validate(createSchema), async (req, res) => {
  const data = req.body;
  const user = await createUser({
    ...data,
    membershipStart: data.membershipStart ? new Date(data.membershipStart) : undefined,
    nextPaymentDue: data.nextPaymentDue ? new Date(data.nextPaymentDue) : undefined
  });
  return res.status(201).json(user);
});

router.post("/invite", requireAuth, requireRole("ADMIN"), otpLimiter, validate(inviteSchema), async (req, res) => {
  try {
    const data = req.body;
    const normalizedEmail = data.email.toLowerCase();
    const redirectTo = resolveAllowedCallbackUrl(data.redirectTo, config.mobileCallbackUrl);

    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: data.name,
          profileImageDataUrl: data.profileImageDataUrl,
          age: data.age,
          fitnessGoals: data.fitnessGoals,
          email: normalizedEmail,
          phone: data.phone,
          role: data.role || "MEMBER",
          membershipStart: data.membershipStart ? new Date(data.membershipStart) : undefined,
          nextPaymentDue: data.nextPaymentDue ? new Date(data.nextPaymentDue) : undefined,
          paymentStatus: data.paymentStatus || "UNPAID",
          paymentMethod: data.paymentMethod
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: data.name,
          profileImageDataUrl: data.profileImageDataUrl ?? user.profileImageDataUrl,
          age: data.age ?? user.age,
          fitnessGoals: data.fitnessGoals ?? user.fitnessGoals,
          phone: data.phone,
          role: data.role || user.role,
          membershipStart: data.membershipStart ? new Date(data.membershipStart) : user.membershipStart,
          nextPaymentDue: data.nextPaymentDue ? new Date(data.nextPaymentDue) : user.nextPaymentDue,
          paymentStatus: data.paymentStatus || user.paymentStatus,
          paymentMethod: data.paymentMethod !== undefined ? data.paymentMethod : user.paymentMethod
        }
      });
    }

    await sendInviteEmail(normalizedEmail, redirectTo);
    return res.status(201).json({
      invite: { sent: true, redirectTo, userId: user.id, email: normalizedEmail }
    });
  } catch (err: any) {
    const message = err?.message || "Failed to send invite";
    const mapped = mapInviteError(message);
    return res.status(mapped.status).json({
      code: mapped.code,
      message: err?.message || "Failed to send invite"
    });
  }
});

router.post("/:id/resend-invite", requireAuth, requireRole("ADMIN"), otpLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const redirectTo = resolveAllowedCallbackUrl(
      typeof req.query.redirectTo === "string" ? req.query.redirectTo : undefined,
      config.mobileCallbackUrl
    );
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });

    // Users without a linked Supabase identity should always be re-invited through admin API.
    // OTP resend with shouldCreateUser=false can fail with provider-side signup constraints.
    if (!user.supabaseUserId) {
      await sendInviteEmail(user.email, redirectTo);
    } else {
      try {
        await resendMagicLink(user.email, redirectTo);
      } catch (resendErr: any) {
        if (!shouldFallbackToInvite(resendErr?.message)) {
          throw resendErr;
        }
        await sendInviteEmail(user.email, redirectTo);
      }
    }

    return res.json({ invite: { resent: true, redirectTo } });
  } catch (err: any) {
    const message = err?.message || "Failed to resend invite";
    const mapped = mapInviteError(message);
    return res.status(mapped.status).json({
      code: mapped.code === "INVITE_FAILED" ? "INVITE_RESEND_FAILED" : mapped.code,
      message: err?.message || "Failed to resend invite"
    });
  }
});

router.post("/:id/approve-web-access", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const approverId = req.user!.id;
  const targetUserId = req.params.id;

  const approver = (await getUserById(approverId)) as any;
  if (!approver?.webAccessApproved) {
    return res.status(403).json({
      code: "AUTH_APPROVER_NOT_ALLOWED",
      message: "Only already approved members can grant web access."
    });
  }

  const target = (await getUserById(targetUserId)) as any;
  if (!target) {
    return res.status(404).json({ code: "NOT_FOUND", message: "User not found" });
  }

  if (target.webAccessApproved) {
    return res.json({
      approval: { approved: true, alreadyApproved: true, userId: targetUserId }
    });
  }

  await approveUserWebAccess(targetUserId, approverId);
  return res.json({
    approval: { approved: true, approvedByUserId: approverId }
  });
});

router.patch("/:id", requireAuth, requireRole("ADMIN"), validate(updateSchema), async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const user = await updateUser(id, {
    ...data,
    membershipStart: data.membershipStart ? new Date(data.membershipStart) : data.membershipStart,
    nextPaymentDue: data.nextPaymentDue ? new Date(data.nextPaymentDue) : data.nextPaymentDue
  });
  return res.json(user);
});

router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { id } = req.params;
  await deleteUser(id);
  return res.status(204).send();
});

router.get("/:id/payments", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { id } = req.params;
  const payments = await prisma.payment.findMany({ where: { userId: id }, orderBy: { date: "desc" } });
  return res.json(payments);
});

router.get("/:id/workout-logs", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { id } = req.params;
  const logs = await listWorkoutLogsByUser(id);
  return res.json(logs);
});

router.get("/:id/coach-stats", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { id } = req.params;
  const classesCoached = await countClassesCoachedByUser(id);
  return res.json({ classesCoached });
});

export default router;
