import React, { useState } from "react";
import axios from "axios";
import { Session } from "@supabase/supabase-js";
import { API_URL, IS_USING_API_FALLBACK, api } from "../api/client";
import { ADMIN_CALLBACK_URL, supabase } from "../lib/supabase";
import { useLocation, useNavigate } from "react-router-dom";
import { clearCachedAuthToken, setCachedAuthToken } from "../lib/authTokenCache";
import BrandedSplash from "../components/BrandedSplash";

type Mode = "magic" | "password" | "reset";

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const loginError = params.get("error");
    if (loginError) {
      setError(loginError);
    }
  }, [location.search]);

  const resetStateForMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setOtpCode("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    if (nextMode !== "reset") setResetCodeSent(false);
  };

  const completeSupabaseLogin = async (session: Session) => {
    const token = session.access_token;
    const res = await api.post(
      "/auth/bootstrap",
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (res.data?.user?.role !== "ADMIN") {
      throw new Error("Only admins can access this dashboard.");
    }

    setCachedAuthToken(token);
    onLogin();
    navigate("/");
  };

  const sendMagicCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: ADMIN_CALLBACK_URL,
        shouldCreateUser: false
      }
    });

    if (authError) throw authError;
    setMessage("Confirmation code sent. Enter the code from your email.");
  };

  const verifyMagicCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !otpCode.trim()) {
      setError("Email and confirmation code are required.");
      return;
    }

    const { data, error: authError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otpCode.trim(),
      type: "email"
    });

    if (authError || !data.session) {
      throw authError || new Error("Invalid confirmation code.");
    }

    await completeSupabaseLogin(data.session);
  };

  const submitPasswordSignIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });
    if (authError || !authData.session) {
      throw authError || new Error("Unable to sign in with password.");
    }

    await completeSupabaseLogin(authData.session);
  };

  const sendResetCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: ADMIN_CALLBACK_URL,
        shouldCreateUser: false
      }
    });

    if (authError) throw authError;
    setResetCodeSent(true);
    setMessage("Password reset code sent. Enter the code and your new password.");
  };

  const confirmResetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = otpCode.trim();
    const trimmedNewPassword = newPassword.trim();

    if (!normalizedEmail || !trimmedCode) {
      setError("Email and confirmation code are required.");
      return;
    }
    if (trimmedNewPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (trimmedNewPassword !== confirmPassword.trim()) {
      setError("Passwords do not match.");
      return;
    }

    const { data, error: authError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: trimmedCode,
      type: "email"
    });

    if (authError || !data.session) {
      throw authError || new Error("Invalid confirmation code.");
    }

    await api.post(
      "/users/me/password",
      { password: trimmedNewPassword },
      {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      }
    );

    await completeSupabaseLogin(data.session);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "magic") {
        if (otpCode.trim()) {
          await verifyMagicCode();
        } else {
          await sendMagicCode();
        }
        return;
      }

      if (mode === "reset") {
        if (!resetCodeSent) {
          await sendResetCode();
        } else {
          await confirmResetPassword();
        }
        return;
      }

      await submitPasswordSignIn();
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.code === "ERR_NETWORK") {
          setError(`Cannot reach API at ${API_URL}. Check VITE_API_URL and backend deployment.`);
          return;
        }

        if (err.response?.status === 404 && IS_USING_API_FALLBACK) {
          setError("No backend route found at /api. Set VITE_API_URL to your public backend URL.");
          return;
        }
      }

      clearCachedAuthToken();
      await supabase.auth.signOut();
      setError(err?.response?.data?.message || err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const submitLabel =
    mode === "magic"
      ? otpCode.trim()
        ? "Verify Code"
        : "Send Confirmation Code"
      : mode === "reset"
      ? resetCodeSent
        ? "Set Password"
        : "Send Reset Code"
      : "Sign In";

  return (
    <BrandedSplash title="Ukali Admin" subtitle="Sign in to manage the gym.">
      <form className="card branded-splash-panel" style={{ width: 460 }} onSubmit={submit}>
        <h2>Ukali Admin</h2>
        <p style={{ color: "var(--muted)" }}>Sign in to manage the gym.</p>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button
            className={mode === "magic" ? "primary-btn" : "secondary-btn"}
            type="button"
            onClick={() => resetStateForMode("magic")}
          >
            Magic Code
          </button>
          <button
            className={mode === "password" ? "primary-btn" : "secondary-btn"}
            type="button"
            onClick={() => resetStateForMode("password")}
          >
            Email Password
          </button>
          <button
            className={mode === "reset" ? "primary-btn" : "secondary-btn"}
            type="button"
            onClick={() => resetStateForMode("reset")}
          >
            Set or Reset Password
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

          {mode === "password" ? (
            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : null}

          {mode === "magic" ? (
            <input
              placeholder="Confirmation code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />
          ) : null}

          {mode === "reset" && resetCodeSent ? (
            <>
              <input
                placeholder="Confirmation code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />
              <input
                placeholder="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                placeholder="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </>
          ) : null}

          {error ? <span style={{ color: "var(--danger)" }}>{error}</span> : null}
          {message ? <span style={{ color: "var(--primary-soft)" }}>{message}</span> : null}

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Please wait..." : submitLabel}
          </button>
        </div>
      </form>
    </BrandedSplash>
  );
}
