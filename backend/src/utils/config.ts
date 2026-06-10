import dotenv from "dotenv";

dotenv.config();

function withLocalhostAliases(origin: string) {
  try {
    const parsed = new URL(origin);
    const aliases = [origin];

    if (parsed.hostname === "localhost") {
      const alias = new URL(origin);
      alias.hostname = "127.0.0.1";
      aliases.push(alias.toString().replace(/\/$/, ""));
    }

    if (parsed.hostname === "127.0.0.1") {
      const alias = new URL(origin);
      alias.hostname = "localhost";
      aliases.push(alias.toString().replace(/\/$/, ""));
    }

    return aliases;
  } catch {
    return [origin];
  }
}

function parseCorsOrigins(rawCorsOrigins: string) {
  const origins = rawCorsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.includes("*")) {
    return ["*"];
  }

  const normalized = new Set<string>();
  for (const origin of origins) {
    for (const alias of withLocalhostAliases(origin)) {
      normalized.add(alias);
    }
  }

  return Array.from(normalized);
}

const defaultDevCorsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
].join(",");

const nodeEnv = process.env.NODE_ENV || "development";
const rawCorsOrigins =
  process.env.CORS_ORIGIN ||
  (nodeEnv === "development" ? defaultDevCorsOrigins : "");

const corsOrigins = parseCorsOrigins(rawCorsOrigins);

function normalizeCallbackUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

function buildAllowedCallbackUrls() {
  return Array.from(
    new Set(
      [process.env.MOBILE_CALLBACK_URL, process.env.ADMIN_CALLBACK_URL]
        .map((value) => value?.trim())
        .filter(Boolean)
        .map((value) => normalizeCallbackUrl(value as string))
    )
  );
}

export const config = {
  nodeEnv,
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
  mobileCallbackUrl: process.env.MOBILE_CALLBACK_URL || "ukali://auth/callback",
  allowedCallbackUrls: buildAllowedCallbackUrls(),
  cronSecret: process.env.CRON_SECRET || ""
};

export function resolveAllowedCallbackUrl(candidate?: string | null, fallback = config.mobileCallbackUrl) {
  const normalizedFallback = normalizeCallbackUrl(fallback);
  if (!candidate) {
    return normalizedFallback;
  }

  const normalizedCandidate = normalizeCallbackUrl(candidate);
  if (config.allowedCallbackUrls.includes(normalizedCandidate)) {
    return normalizedCandidate;
  }

  return normalizedFallback;
}

if (!config.jwtSecret) {
  console.warn("JWT_SECRET is not set; auth will be insecure.");
}

if (!config.supabaseUrl || !config.supabaseServiceRoleKey || !config.supabaseAnonKey) {
  console.warn("Supabase auth env vars are missing; Supabase auth routes will fail.");
}

if (config.nodeEnv !== "development" && config.corsOrigins.length === 0) {
  console.warn("CORS_ORIGIN is not set; browser requests will be denied until allowed origins are configured.");
}
