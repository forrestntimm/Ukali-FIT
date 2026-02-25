import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

export function requireRole(role: "ADMIN" | "MEMBER") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ code: "AUTH_UNAUTHORIZED", message: "Unauthorized" });
    if (req.user.role !== role) {
      return res.status(403).json({ code: "AUTH_ROLE_FORBIDDEN", message: "Forbidden" });
    }
    return next();
  };
}
