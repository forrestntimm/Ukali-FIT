import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";
import { config } from "../utils/config";
import { getUserById } from "./userService";

export interface LegacyAuthPayload {
  sub: string;
  role: "ADMIN" | "MEMBER";
}

export async function authenticateBreakGlass(email: string, password: string) {
  const normalizedEmail = email.toLowerCase();
  if (!config.breakGlassAdminEmails.includes(normalizedEmail)) {
    return { error: "BREAK_GLASS_ONLY" as const };
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.role !== "ADMIN" || !user.passwordHash) {
    return { error: "INVALID_CREDENTIALS" as const };
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return { error: "INVALID_CREDENTIALS" as const };

  const token = jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"]
  });

  const safeUser = await getUserById(user.id);
  if (!safeUser) {
    return { error: "INVALID_CREDENTIALS" as const };
  }
  return { token, user: safeUser };
}

export function verifyLegacyToken(token: string): LegacyAuthPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as LegacyAuthPayload;
    return payload;
  } catch {
    return null;
  }
}
