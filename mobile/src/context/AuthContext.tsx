import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import { AuthChangeEvent, EmailOtpType, Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import { IS_COACH_APP } from "../config/appVariant";
import { clearCachedAccessToken, setCachedAccessToken } from "../lib/authTokenCache";
import { clearBiometricCredentials, getBiometricCredentialMetadata, getBiometricCredentials, saveBiometricCredentials } from "../lib/biometricCredentials";
import { supabase } from "../lib/supabase";
import { safeClearSession, safeGetSession } from "../lib/sessionGuard";

interface User {
  id: string;
  name: string;
  profileImageDataUrl?: string | null;
  email: string;
  role: "ADMIN" | "MEMBER";
  age?: number | null;
  fitnessGoals?: string | null;
  checkInQrCode?: string;
  workoutStreak?: number;
  classesTotalAttended?: number;
  daysLeftInMembership?: number;
  nextPaymentDue?: string;
  paymentStatus?: "PAID" | "UNPAID";
  personalRecords?: {
    deadlift?: string | null;
    backSquat?: string | null;
    frontSquat?: string | null;
    cleans?: string | null;
    pushPress?: string | null;
    strictPress?: string | null;
    pushJerk?: string | null;
    benchPress?: string | null;
    oneMileRun?: string | null;
    fiveKilometerRun?: string | null;
  } | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: string | null;
  biometricLoginAvailable: boolean;
  biometricLoginEmail: string | null;
  refreshUser: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithBiometrics: () => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  consumeMagicLinkUrl: (url: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const USER_CACHE_STORAGE_KEY = IS_COACH_APP ? "ukali-coach-user-cache-v1" : "ukali-athlete-user-cache-v1";
const USER_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CachedUserRecord = {
  user: User;
  cachedAt: number;
};

function normalizeCachedUser(raw: unknown): CachedUserRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  if ("user" in raw && raw.user && typeof raw.user === "object" && "cachedAt" in raw && typeof raw.cachedAt === "number") {
    return raw as CachedUserRecord;
  }

  if ("id" in raw && typeof (raw as User).id === "string") {
    return {
      user: raw as User,
      cachedAt: Date.now()
    };
  }

  return null;
}

function isCachedUserFresh(cachedUser: CachedUserRecord) {
  return Date.now() - cachedUser.cachedAt <= USER_CACHE_MAX_AGE_MS;
}

function getSafeCachedUserForSession(cachedUser: CachedUserRecord | null, session: Session) {
  if (!cachedUser) return null;
  if (!isCachedUserFresh(cachedUser)) return null;
  if (cachedUser.user.id === session.user.id) return cachedUser.user;
  return null;
}

async function restoreCachedUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_CACHE_STORAGE_KEY);
    return raw ? normalizeCachedUser(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function cacheUser(user: User | null) {
  if (!user) {
    await AsyncStorage.removeItem(USER_CACHE_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(
    USER_CACHE_STORAGE_KEY,
    JSON.stringify({
      user,
      cachedAt: Date.now()
    } satisfies CachedUserRecord)
  );
}

function tokensFromUrl(url: string) {
  const parts = url.split("#");
  const hash = parts[1] || "";
  const queryPart = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(queryPart);

  const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");
  const tokenHash = hashParams.get("token_hash") || queryParams.get("token_hash");
  const token = hashParams.get("token") || queryParams.get("token");
  const type = (hashParams.get("type") || queryParams.get("type")) as EmailOtpType | null;

  return { accessToken, refreshToken, tokenHash, token, type };
}

function isAuthCallbackUrl(url: string) {
  return url.toLowerCase().includes("auth/callback");
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [biometricLoginEmail, setBiometricLoginEmail] = useState<string | null>(null);

  const clearAuthSession = useCallback(async () => {
    await safeClearSession(supabase);
    clearCachedAccessToken();
  }, []);

  const bootstrap = async (session: Session) => {
    setCachedAccessToken(session.access_token);
    const res = await api.post(
      "/auth/bootstrap",
      {},
      {
        headers: { Authorization: `Bearer ${session.access_token}` }
      }
    );

    setAuthError(null);
    setUser(res.data.user);
    await cacheUser(res.data.user);
  };

  const refreshBiometricAvailability = useCallback(async () => {
    const metadata = await getBiometricCredentialMetadata();
    setBiometricLoginEmail(metadata?.email ?? null);
  }, []);

  const handleDeepLink = async (url: string) => {
    const { accessToken, refreshToken, tokenHash, token, type } = tokensFromUrl(url);
    const hasAuthPayload = Boolean(accessToken || refreshToken || tokenHash || token || type);

    if (!hasAuthPayload && !isAuthCallbackUrl(url)) {
      return;
    }

    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error || !data.session) {
        setAuthError(error?.message || "Unable to establish session from link.");
        return;
      }
      await bootstrap(data.session);
      return;
    }

    if (tokenHash && type) {
      const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error || !data.session) {
        setAuthError(error?.message || "Unable to verify magic link.");
        return;
      }
      await bootstrap(data.session);
      return;
    }

    if (token && type) {
      const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: token });
      if (error || !data.session) {
        setAuthError(error?.message || "Unable to verify login token.");
        return;
      }
      await bootstrap(data.session);
      return;
    }

    if (isAuthCallbackUrl(url)) {
      setAuthError("Invalid or incomplete magic link.");
    }
  };

  useEffect(() => {
    let mounted = true;
    let authSubscriptionCleanup = () => {};

    const init = async () => {
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) {
            try {
              await handleDeepLink(initialUrl);
            } catch (err: any) {
              setAuthError(err?.message || "Failed to process login link.");
            }
          }

          const [{ data }, cachedUser] = await Promise.all([
            safeGetSession(supabase),
            restoreCachedUser()
          ]);
          void refreshBiometricAvailability();
          if (data.session) {
            setCachedAccessToken(data.session.access_token);
            const startupFallbackUser = getSafeCachedUserForSession(cachedUser, data.session);
            if (startupFallbackUser) {
              setUser(startupFallbackUser);
              if (mounted) setLoading(false);
            }
            try {
              await bootstrap(data.session);
            } catch (err: any) {
              setAuthError(err?.message || "Failed to refresh your account. Using your saved profile.");
              if (!startupFallbackUser) {
                setUser(null);
              }
            }
            return;
          }
          clearCachedAccessToken();
          await cacheUser(null);
          setUser(null);
        } catch (error: any) {
          void refreshBiometricAvailability();
          setAuthError(error?.message || "Session restore failed. Please sign in again if needed.");
          setUser(null);
        } finally {
          if (mounted) setLoading(false);
        }
    };

    void init();

    const deepLinkSub = Linking.addEventListener("url", ({ url }) => {
      void handleDeepLink(url).catch((error: any) => {
        setAuthError(error?.message || "Failed to process login link.");
      });
    });

    try {
      const { data: authSub } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
        setCachedAccessToken(session?.access_token || null);

        if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
          return;
        }

        if (session) {
          return;
        }

        if (event === "SIGNED_OUT") {
          void cacheUser(null);
          setUser(null);
          setAuthError(null);
        }
      });

      authSubscriptionCleanup = () => {
        authSub.subscription.unsubscribe();
      };
    } catch (error: any) {
      setAuthError(error?.message || "Session listener failed. Stored sign-in will be retried on next launch.");
    }

    return () => {
      mounted = false;
      deepLinkSub.remove();
      authSubscriptionCleanup();
    };
  }, [clearAuthSession, refreshBiometricAvailability]);

  const sendMagicLink = async (email: string) => {
    const normalized = email.trim().toLowerCase();
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: false
      }
    });

    if (error) {
      throw error;
    }
  };

  const verifyOtp = async (email: string, code: string) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email"
    });

    if (error || !data.session) {
      throw error || new Error("Unable to verify code");
    }

    await bootstrap(data.session);
  };

  const signInWithPassword = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (error || !data.session) {
      throw error || new Error("Unable to sign in with password");
    }

    await bootstrap(data.session);
    await saveBiometricCredentials(normalizedEmail, password);
    await refreshBiometricAvailability();
  };

  const signInWithBiometrics = async () => {
    setAuthError(null);

    const credentials = await getBiometricCredentials();
    if (!credentials) {
      await clearBiometricCredentials();
      await refreshBiometricAvailability();
      throw new Error("No saved Face ID login is available. Sign in with your password once to enable it again.");
    }

    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error || !data.session) {
      throw error || new Error("Unable to sign in with Face ID");
    }

    await bootstrap(data.session);
    await refreshBiometricAvailability();
  };

  const setPassword = async (password: string) => {
    setAuthError(null);
    await api.post("/users/me/password", { password });
    if (user?.email) {
      await saveBiometricCredentials(user.email, password);
      await refreshBiometricAvailability();
    }
  };

  const consumeMagicLinkUrl = async (url: string) => {
    setAuthError(null);
    await handleDeepLink(url);
  };

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await safeGetSession(supabase);
      if (!data.session) {
        await cacheUser(null);
        setUser(null);
        return;
      }
      await bootstrap(data.session);
    } catch (error) {
      const { data } = await safeGetSession(supabase);
      const cachedUser = await restoreCachedUser();
      if (data.session) {
        const fallbackUser = getSafeCachedUserForSession(cachedUser, data.session);
        if (fallbackUser) {
          setUser(fallbackUser);
        }
      }
      throw error;
    }
  }, [clearAuthSession]);

  const signOut = async () => {
    await clearAuthSession();
    await cacheUser(null);
    setAuthError(null);
    setUser(null);
    clearCachedAccessToken();
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      biometricLoginAvailable: Boolean(biometricLoginEmail),
      biometricLoginEmail,
      refreshUser,
      sendMagicLink,
      verifyOtp,
      signInWithPassword,
      signInWithBiometrics,
      setPassword,
      consumeMagicLinkUrl,
      signOut
    }),
    [user, loading, authError, biometricLoginEmail, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
