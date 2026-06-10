import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { IS_COACH_APP } from "../config/appVariant";
import { RUNTIME_CONFIG, RUNTIME_CONFIG_ERROR } from "../config/runtimeConfig";

const AUTH_STORAGE_KEY = IS_COACH_APP ? "ukali-coach-auth-v2" : "ukali-athlete-auth-v2";

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key)
};

type SupabaseClient = ReturnType<typeof createClient>;

const missingConfigSupabaseClient = new Proxy({} as SupabaseClient, {
  get() {
    throw new Error(RUNTIME_CONFIG_ERROR || "Supabase client is unavailable because required runtime configuration is missing.");
  }
});

export const supabase: SupabaseClient =
  RUNTIME_CONFIG_ERROR || !RUNTIME_CONFIG.supabaseUrl || !RUNTIME_CONFIG.supabaseAnonKey
    ? missingConfigSupabaseClient
    : createClient(RUNTIME_CONFIG.supabaseUrl, RUNTIME_CONFIG.supabaseAnonKey, {
        auth: {
          storageKey: AUTH_STORAGE_KEY,
          storage: secureStoreAdapter as any,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false
        }
      });

const DEFAULT_MOBILE_MAGIC_LINK_REDIRECT_URL = IS_COACH_APP ? "ukali-coach://auth/callback" : "ukali://auth/callback";
const configuredMagicLinkRedirectUrl = process.env.EXPO_PUBLIC_MAGIC_LINK_REDIRECT_URL?.trim();
const expectedMobileScheme = IS_COACH_APP ? "ukali-coach://" : "ukali://";
const isConfiguredMobileDeepLink = configuredMagicLinkRedirectUrl?.startsWith(expectedMobileScheme);

export const MOBILE_MAGIC_LINK_REDIRECT_URL =
  isConfiguredMobileDeepLink
    ? configuredMagicLinkRedirectUrl
    : DEFAULT_MOBILE_MAGIC_LINK_REDIRECT_URL;

if (__DEV__ && configuredMagicLinkRedirectUrl && !isConfiguredMobileDeepLink) {
  console.warn(
    `[auth] Ignoring EXPO_PUBLIC_MAGIC_LINK_REDIRECT_URL=${configuredMagicLinkRedirectUrl}; expected scheme ${expectedMobileScheme}, using ${DEFAULT_MOBILE_MAGIC_LINK_REDIRECT_URL}`
  );
}
