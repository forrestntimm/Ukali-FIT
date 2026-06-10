export type AppVariant = "athlete" | "coach";

function parseVariant(value: string | undefined): AppVariant | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "coach" || normalized === "athlete") {
    return normalized;
  }
  return null;
}

function parseVariantFromApplicationId(applicationId: string | null | undefined): AppVariant | null {
  const normalized = applicationId?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "com.forresttimm.ukaliadmin") return "coach";
  if (normalized === "com.forresttimm.ukalifit") return "athlete";
  if (normalized === "com.ukalifit.coach") return "coach";
  if (normalized === "com.ukalifit.app") return "athlete";
  return null;
}

function resolveNativeApplicationId(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const applicationModule = require("expo-application") as { applicationId?: string | null };
    return applicationModule.applicationId ?? null;
  } catch {
    return null;
  }
}

const appVariantFromNativeId = parseVariantFromApplicationId(resolveNativeApplicationId());
const appVariantFromEnv = parseVariant(process.env.EXPO_PUBLIC_APP_VARIANT);

export const APP_VARIANT = appVariantFromNativeId ?? appVariantFromEnv;
export const APP_VARIANT_SOURCE = appVariantFromNativeId ? "native_app_id" : appVariantFromEnv ? "expo_public_env" : "unresolved";
export const VARIANT_CONFIG_ERROR =
  APP_VARIANT === null
    ? "App variant could not be resolved. Use npm run start:athlete or npm run start:coach."
    : null;
export const IS_COACH_APP = APP_VARIANT === "coach";

export const APP_DISPLAY_NAME = APP_VARIANT === "coach" ? "Ukali Admin" : APP_VARIANT === "athlete" ? "Ukali Fit" : "Ukali";
export const APP_ACCESS_SUBTITLE = APP_VARIANT === "coach" ? "Admin Access" : APP_VARIANT === "athlete" ? "Member Login" : "Variant Required";
export const ADMIN_WEB_APP_URL = process.env.EXPO_PUBLIC_ADMIN_APP_URL || "https://ukalifitadmin.com";
export const ATHLETE_APP_DEEP_LINK_URL = process.env.EXPO_PUBLIC_ATHLETE_APP_DEEP_LINK_URL || "ukali://";

if (__DEV__ && appVariantFromNativeId && appVariantFromEnv && appVariantFromNativeId !== appVariantFromEnv) {
  console.warn(
    `[variant] Native app ID variant (${appVariantFromNativeId}) overrides EXPO_PUBLIC_APP_VARIANT (${appVariantFromEnv}).`
  );
}
