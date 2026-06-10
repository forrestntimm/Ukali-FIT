import { Request, Response, NextFunction } from "express";
import { verifyLegacyToken } from "../services/authService";
import { extractBearerToken, resolveLocalUserFromSupabaseToken } from "../services/supabaseAuthService";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: "ADMIN" | "MEMBER";
    email?: string;
    webAccessApproved?: boolean;
    authProvider?: "legacy" | "supabase";
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ code: "AUTH_UNAUTHORIZED", message: "Missing or invalid Authorization header" });
  }

  const legacyPayload = verifyLegacyToken(token);
  if (legacyPayload) {
    req.user = { id: legacyPayload.sub, role: legacyPayload.role, authProvider: "legacy" };
    return next();
  }

  let resolved: Awaited<ReturnType<typeof resolveLocalUserFromSupabaseToken>>;
  try {
    resolved = await resolveLocalUserFromSupabaseToken(token);
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

  req.user = {
    id: resolved.authUser.id,
    role: resolved.authUser.role,
    email: resolved.authUser.email,
    webAccessApproved: resolved.authUser.webAccessApproved,
    authProvider: "supabase"
  };
  return next();
}
