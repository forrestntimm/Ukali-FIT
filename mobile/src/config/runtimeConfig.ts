const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const configuredSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const configuredSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

const missingReleaseConfig = [
  !configuredApiUrl && "EXPO_PUBLIC_API_URL",
  !configuredSupabaseUrl && "EXPO_PUBLIC_SUPABASE_URL",
  !configuredSupabaseAnonKey && "EXPO_PUBLIC_SUPABASE_ANON_KEY"
].filter(Boolean) as string[];

export const RUNTIME_CONFIG = {
  apiUrl: configuredApiUrl || (__DEV__ ? "http://localhost:4000/api" : null),
  supabaseUrl: configuredSupabaseUrl || null,
  supabaseAnonKey: configuredSupabaseAnonKey || null
};

export const RUNTIME_CONFIG_ERROR =
  missingReleaseConfig.length > 0
    ? `Missing app configuration: ${missingReleaseConfig.join(", ")}. Configure these values in the Expo/EAS environment before building a release.`
    : null;
