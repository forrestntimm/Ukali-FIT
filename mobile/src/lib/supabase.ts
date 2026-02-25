import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { IS_COACH_APP } from "../config/appVariant";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key)
};

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    storage: secureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

const DEFAULT_MOBILE_MAGIC_LINK_REDIRECT_URL = IS_COACH_APP ? "ukali-coach://auth/callback" : "ukali://auth/callback";
const configuredMagicLinkRedirectUrl = process.env.EXPO_PUBLIC_MAGIC_LINK_REDIRECT_URL?.trim();
const isConfiguredMobileDeepLink =
  configuredMagicLinkRedirectUrl?.startsWith("ukali://") || configuredMagicLinkRedirectUrl?.startsWith("ukali-coach://");

export const MOBILE_MAGIC_LINK_REDIRECT_URL =
  isConfiguredMobileDeepLink
    ? configuredMagicLinkRedirectUrl
    : DEFAULT_MOBILE_MAGIC_LINK_REDIRECT_URL;

if (__DEV__ && configuredMagicLinkRedirectUrl && !isConfiguredMobileDeepLink) {
  console.warn(
    `[auth] Ignoring EXPO_PUBLIC_MAGIC_LINK_REDIRECT_URL=${configuredMagicLinkRedirectUrl}; using ${DEFAULT_MOBILE_MAGIC_LINK_REDIRECT_URL}`
  );
}
