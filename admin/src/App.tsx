import React, { useCallback, useEffect, useState } from "react";
import { NavLink, Route, Routes, useNavigate, Outlet, Navigate } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import MembersPage from "./pages/MembersPage";
import PaymentsPage from "./pages/PaymentsPage";
import WodPage from "./pages/WodPage";
import ClassesPage from "./pages/ClassesPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import LoginPage from "./pages/LoginPage";
import { api } from "./api/client";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { Session } from "@supabase/supabase-js";

function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="main-layout">
      <aside className="sidebar">
        <div className="logo">Ukali Admin</div>
        <nav style={{ display: "grid", gap: 8 }}>
          <NavLink className="nav-link" to="/">Dashboard</NavLink>
          <NavLink className="nav-link" to="/members">Members</NavLink>
          <NavLink className="nav-link" to="/payments">Payments</NavLink>
          <NavLink className="nav-link" to="/wod">WOD</NavLink>
          <NavLink className="nav-link" to="/classes">Classes</NavLink>
          <NavLink className="nav-link" to="/announcements">Announcements</NavLink>
        </nav>
        <button className="secondary-btn" onClick={onLogout}>Sign Out</button>
      </aside>
      <main>
        <div className="topbar">
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Admin Console</div>
          <div style={{ fontSize: 12, fontFamily: "IBM Plex Mono", color: "var(--primary-soft)" }}>
            secure
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!isSupabaseConfigured) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 620 }}>
          <h2>Admin Site Needs Environment Variables</h2>
          <p style={{ color: "var(--muted)" }}>
            This deployment is missing required Supabase settings.
          </p>
          <p style={{ marginBottom: 0 }}>Add these in Vercel Project Settings - Environment Variables:</p>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_URL
VITE_ADMIN_CALLBACK_URL
VITE_BREAK_GLASS_ADMIN_EMAILS
          </pre>
        </div>
      </div>
    );
  }

  const completeSupabaseLogin = useCallback(
    async (session: Session) => {
      localStorage.setItem("auth_token", session.access_token);
      try {
        const res = await api.post(
          "/auth/bootstrap",
          {},
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );

        if (res.data?.user?.role !== "ADMIN") {
          throw new Error("Only admins can access this dashboard.");
        }

        setAuthed(true);
        navigate("/");
      } catch {
        localStorage.removeItem("auth_token");
        await supabase.auth.signOut();
        setAuthed(false);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        await completeSupabaseLogin(data.session);
        return;
      }

      const token = localStorage.getItem("auth_token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get("/users/me", { headers: { Authorization: `Bearer ${token}` } });
        if (res.data?.role === "ADMIN") {
          setAuthed(true);
        } else {
          localStorage.removeItem("auth_token");
          setAuthed(false);
        }
      } catch {
        localStorage.removeItem("auth_token");
        setAuthed(false);
      } finally {
        setLoading(false);
      }
    };

    void init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void completeSupabaseLogin(session);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [completeSupabaseLogin]);

  const handleLogout = useCallback(async () => {
    localStorage.removeItem("auth_token");
    await supabase.auth.signOut();
    setAuthed(false);
    navigate("/login");
  }, [navigate]);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={authed ? <Navigate to="/" replace /> : <LoginPage onLogin={() => setAuthed(true)} />}
      />
      <Route
        path="/auth/callback"
        element={authed ? <Navigate to="/" replace /> : <LoginPage onLogin={() => setAuthed(true)} />}
      />
      {authed ? (
        <Route path="/" element={<Layout onLogout={handleLogout} />}>
          <Route index element={<DashboardPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="wod" element={<WodPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
        </Route>
      ) : (
        <Route path="*" element={<LoginPage onLogin={() => setAuthed(true)} />} />
      )}
    </Routes>
  );
}
