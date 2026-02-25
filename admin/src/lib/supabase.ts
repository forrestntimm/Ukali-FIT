import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

// Use a safe placeholder client when env vars are missing so the UI can render a configuration screen.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : "https://example.supabase.co",
  isSupabaseConfigured ? supabaseAnonKey! : "sb_publishable_placeholder",
  {
    auth: {
      autoRefreshToken: isSupabaseConfigured,
      persistSession: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured
    }
  }
);

export const ADMIN_CALLBACK_URL =
  import.meta.env.VITE_ADMIN_CALLBACK_URL || `${window.location.origin}/auth/callback`;

export const BREAK_GLASS_ADMIN_EMAILS = (import.meta.env.VITE_BREAK_GLASS_ADMIN_EMAILS || "")
  .split(",")
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);
