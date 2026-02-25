import { Router } from "express";
import { z } from "zod";
import { authenticateBreakGlass } from "../services/authService";
import { validate } from "../middleware/validate";
import { authLimiter } from "../middleware/rateLimit";
import { extractBearerToken, resolveLocalUserFromSupabaseToken } from "../services/supabaseAuthService";

const router = Router();

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6)
  })
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const result = await authenticateBreakGlass(email, password);
  if ("error" in result) {
    if (result.error === "BREAK_GLASS_ONLY") {
      return res.status(403).json({
        code: "AUTH_BREAK_GLASS_ONLY",
        message: "Password sign-in is restricted to break-glass admins."
      });
    }
    return res.status(401).json({ code: "AUTH_UNAUTHORIZED", message: "Invalid credentials" });
  }

  return res.json({ token: result.token, user: result.user, authMode: "break_glass_password" });
});

router.post("/bootstrap", async (req, res) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ code: "AUTH_UNAUTHORIZED", message: "Missing or invalid Authorization header" });
  }

  let resolved: Awaited<ReturnType<typeof resolveLocalUserFromSupabaseToken>>;
  try {
    resolved = await resolveLocalUserFromSupabaseToken(token, { markLogin: true });
  } catch {
    return res.status(500).json({
      code: "AUTH_PROVIDER_MISCONFIGURED",
      message: "Supabase auth is not configured."
    });
  }
  if ("error" in resolved) {
    if (resolved.error === "AUTH_ACCOUNT_NOT_PROVISIONED") {
      return res.status(403).json({
        code: "AUTH_ACCOUNT_NOT_PROVISIONED",
        message: "Your account is not provisioned. Please contact the gym admin."
      });
    }
    return res.status(401).json({ code: "AUTH_UNAUTHORIZED", message: "Invalid or expired token" });
  }

  return res.json({ user: resolved.user });
});

export default router;
