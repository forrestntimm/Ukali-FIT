import React, { useState } from "react";
import axios from "axios";
import { API_URL, IS_USING_API_FALLBACK, api } from "../api/client";
import { ADMIN_CALLBACK_URL, BREAK_GLASS_ADMIN_EMAILS, supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: ADMIN_CALLBACK_URL,
          shouldCreateUser: false
        }
      });

      if (authError) throw authError;
      setMessage("Magic link sent. Open it on this browser to finish sign in.");
    } catch (err: any) {
      setError(err?.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordFallback = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!BREAK_GLASS_ADMIN_EMAILS.includes(normalizedEmail)) {
        throw new Error("Password sign-in is restricted to break-glass admins.");
      }

      const res = await api.post("/auth/login", { email: normalizedEmail, password });
      localStorage.setItem("auth_token", res.data.token);
      onLogin();
      navigate("/");
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
      setError(err?.response?.data?.message || err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form className="card" style={{ width: 420 }} onSubmit={mode === "magic" ? sendMagicLink : submitPasswordFallback}>
        <h2>Ukali Admin</h2>
        <p style={{ color: "var(--muted)" }}>Sign in to manage the gym.</p>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            className={mode === "magic" ? "primary-btn" : "secondary-btn"}
            type="button"
            onClick={() => setMode("magic")}
          >
            Magic Link
          </button>
          <button
            className={mode === "password" ? "primary-btn" : "secondary-btn"}
            type="button"
            onClick={() => setMode("password")}
          >
            Break-Glass Password
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

          {error ? <span style={{ color: "var(--danger)" }}>{error}</span> : null}
          {message ? <span style={{ color: "var(--primary-soft)" }}>{message}</span> : null}

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "magic" ? "Send Magic Link" : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
