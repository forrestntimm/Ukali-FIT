import { supabase } from "./supabase";
import { resolveAuthToken } from "../utils/auth-token.js";

let cachedAuthToken: string | null = null;
let inflightTokenPromise: Promise<string | null> | null = null;

function normalizeToken(value: string | null | undefined) {
  const normalized = (value || "").trim();
  return normalized || null;
}

export function setCachedAuthToken(token: string | null | undefined) {
  const normalized = normalizeToken(token);
  cachedAuthToken = normalized;

  if (typeof window !== "undefined") {
    if (normalized) {
      localStorage.setItem("auth_token", normalized);
    } else {
      localStorage.removeItem("auth_token");
    }
  }

  return normalized;
}

export function clearCachedAuthToken() {
  cachedAuthToken = null;
  inflightTokenPromise = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
  }
}

export function primeCachedAuthTokenFromStorage() {
  if (typeof window === "undefined") return null;
  const token = normalizeToken(localStorage.getItem("auth_token"));
  if (token) {
    cachedAuthToken = token;
  }
  return token;
}

export async function getCachedAuthToken() {
  if (cachedAuthToken) return cachedAuthToken;

  const localToken = primeCachedAuthTokenFromStorage();
  if (localToken) return localToken;

  if (!inflightTokenPromise) {
    inflightTokenPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      const token = resolveAuthToken(localStorage.getItem("auth_token"), data.session?.access_token || "");
      return setCachedAuthToken(token);
    })().finally(() => {
      inflightTokenPromise = null;
    });
  }

  return inflightTokenPromise;
}
