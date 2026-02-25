export type AppVariant = "athlete" | "coach";

function parseVariant(value: string | undefined): AppVariant {
  return value?.toLowerCase() === "coach" ? "coach" : "athlete";
}

export const APP_VARIANT = parseVariant(process.env.EXPO_PUBLIC_APP_VARIANT);
export const IS_COACH_APP = APP_VARIANT === "coach";

export const APP_DISPLAY_NAME = IS_COACH_APP ? "Ukali Coach" : "Ukali Fit";
export const APP_ACCESS_SUBTITLE = IS_COACH_APP ? "Coach Access" : "Member Access";
