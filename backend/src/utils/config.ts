import dotenv from "dotenv";

dotenv.config();

const corsOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigins,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseJwtAud: process.env.SUPABASE_JWT_AUD || "authenticated",
  memberPaymentsEnabled: process.env.MEMBER_PAYMENTS_ENABLED === "true",
  breakGlassAdminEmails: (process.env.BREAK_GLASS_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  adminCallbackUrl: process.env.ADMIN_CALLBACK_URL || "http://localhost:5173/auth/callback",
  mobileCallbackUrl: process.env.MOBILE_CALLBACK_URL || "ukali://auth/callback"
};

if (!config.jwtSecret) {
  console.warn("JWT_SECRET is not set; auth will be insecure.");
}

if (!config.supabaseUrl || !config.supabaseServiceRoleKey || !config.supabaseAnonKey) {
  console.warn("Supabase auth env vars are missing; Supabase auth routes will fail.");
}
