import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import { EmailOtpType, Session } from "@supabase/supabase-js";
import { api } from "../api/client";
import { MOBILE_MAGIC_LINK_REDIRECT_URL, supabase } from "../lib/supabase";

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
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: string | null;
  refreshUser: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  consumeMagicLinkUrl: (url: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const bootstrap = async (session: Session) => {
    const res = await api.post(
      "/auth/bootstrap",
      {},
      {
        headers: { Authorization: `Bearer ${session.access_token}` }
      }
    );

    setAuthError(null);
    setUser(res.data.user);
  };

  const handleDeepLink = async (url: string) => {
    const { accessToken, refreshToken, tokenHash, token, type } = tokensFromUrl(url);

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

    setAuthError("Invalid or incomplete magic link.");
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        try {
          await handleDeepLink(initialUrl);
        } catch (err: any) {
          setAuthError(err?.message || "Failed to process login link.");
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        try {
          await bootstrap(data.session);
        } catch (err: any) {
          setAuthError(err?.message || "Failed to load account profile.");
          await supabase.auth.signOut();
          setUser(null);
        }
      }

      if (mounted) setLoading(false);
    };

    void init();

    const deepLinkSub = Linking.addEventListener("url", ({ url }) => {
      void handleDeepLink(url);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void bootstrap(session).catch(async () => {
          setAuthError("Signed in, but failed to bootstrap your account.");
          await supabase.auth.signOut();
          setUser(null);
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      deepLinkSub.remove();
      authSub.subscription.unsubscribe();
    };
  }, []);

  const sendMagicLink = async (email: string) => {
    const normalized = email.trim().toLowerCase();
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: MOBILE_MAGIC_LINK_REDIRECT_URL
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
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error || !data.session) {
      throw error || new Error("Unable to sign in with password");
    }

    await bootstrap(data.session);
  };

  const setPassword = async (password: string) => {
    setAuthError(null);
    await api.post("/users/me/password", { password });
  };

  const consumeMagicLinkUrl = async (url: string) => {
    setAuthError(null);
    await handleDeepLink(url);
  };

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setUser(null);
      return;
    }
    await bootstrap(data.session);
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthError(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, authError, refreshUser, sendMagicLink, verifyOtp, signInWithPassword, setPassword, consumeMagicLinkUrl, signOut }),
    [user, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
