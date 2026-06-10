import React, { useCallback, useEffect, useState } from "react";
import { NavLink, Route, Routes, useNavigate, Outlet, Navigate, useLocation } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import MembersPage from "./pages/MembersPage";
import PaymentsPage from "./pages/PaymentsPage";
import WodPage from "./pages/WodPage";
import SchedulingPage from "./pages/SchedulingPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import LoginPage from "./pages/LoginPage";
import BrandedSplash from "./components/BrandedSplash";
import { api } from "./api/client";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { Session } from "@supabase/supabase-js";
import axios from "axios";
import { shouldRouteToDashboardAfterAuth } from "./utils/auth-navigation";
import { clearCachedAuthToken, primeCachedAuthTokenFromStorage, setCachedAuthToken } from "./lib/authTokenCache";
import { isPageCacheFresh, readPageCache, writePageCache } from "./lib/pageCache";

const APP_TIME_ZONE = "Asia/Kathmandu";
const SCHEDULING_CACHE_TTL_MS = 5 * 60 * 1000;
const DASHBOARD_STATS_CACHE_KEY = "admin-dashboard-stats";
const DASHBOARD_STATS_TTL_MS = 2 * 60 * 1000;
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function getDateKeyInAppTimeZone(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = DATE_KEY_FORMATTER
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDateKey(dateKey: string, days: number) {
  const base = new Date(`${dateKey}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function getWeekStartKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return shiftDateKey(dateKey, -daysSinceMonday);
}

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
          <NavLink className="nav-link" to="/scheduling">Scheduling</NavLink>
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
  const location = useLocation();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!isSupabaseConfigured) {
    return (
      <BrandedSplash title="Ukali Admin" subtitle="This deployment still needs its secure environment setup.">
        <div className="card branded-splash-panel" style={{ maxWidth: 620 }}>
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
          </pre>
        </div>
      </BrandedSplash>
    );
  }

  const completeSupabaseLogin = useCallback(
    async (session: Session) => {
      setCachedAuthToken(session.access_token);
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
        if (shouldRouteToDashboardAfterAuth(location.pathname)) {
          navigate("/", { replace: true });
        }
      } catch (err: any) {
        let message = "Sign in failed.";
        if (axios.isAxiosError(err)) {
          message = err?.response?.data?.message || message;
        }
        clearCachedAuthToken();
        await supabase.auth.signOut();
        setAuthed(false);
        navigate(`/login?error=${encodeURIComponent(message)}`);
      } finally {
        setLoading(false);
      }
    },
    [location.pathname, navigate]
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const token = primeCachedAuthTokenFromStorage();
      if (token) {
        try {
          const res = await api.get("/users/me", { headers: { Authorization: `Bearer ${token}` } });
          if (!mounted) return;
          if (res.data?.role === "ADMIN") {
            setAuthed(true);
          } else {
            clearCachedAuthToken();
            setAuthed(false);
          }
        } catch {
          if (!mounted) return;
          clearCachedAuthToken();
          setAuthed(false);
        } finally {
          if (mounted) setLoading(false);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        await completeSupabaseLogin(data.session);
        return;
      }

      setLoading(false);
    };

    void init();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearCachedAuthToken();
        setAuthed(false);
        return;
      }

      if (session) {
        void completeSupabaseLogin(session);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [completeSupabaseLogin]);

  useEffect(() => {
    if (!authed) return;

    let cancelled = false;
    const todayKey = getDateKeyInAppTimeZone(new Date());
    const weekStartKey = getWeekStartKey(todayKey);
    const weekEndKey = shiftDateKey(weekStartKey, 4);
    const scheduleCacheKey = `scheduling:${weekStartKey}:${weekEndKey}`;
    const cachedStats = readPageCache<unknown>(DASHBOARD_STATS_CACHE_KEY);
    const cachedCoaches = readPageCache<unknown[]>("admin-coaches");
    const cachedSchedule = readPageCache<unknown[]>(scheduleCacheKey);

    const warmDashboard =
      cachedStats && isPageCacheFresh(cachedStats.savedAt, DASHBOARD_STATS_TTL_MS)
        ? Promise.resolve()
        : api
            .get("/users/stats")
            .then((res) => {
              if (!cancelled) writePageCache(DASHBOARD_STATS_CACHE_KEY, res.data);
            })
            .catch(() => {});

    const warmCoaches =
      cachedCoaches && isPageCacheFresh(cachedCoaches.savedAt, SCHEDULING_CACHE_TTL_MS)
        ? Promise.resolve()
        : api
            .get("/users/coaches")
            .then((res) => {
              if (!cancelled) writePageCache("admin-coaches", res.data);
            })
            .catch(() => {});

    const warmSchedule =
      cachedSchedule && isPageCacheFresh(cachedSchedule.savedAt, SCHEDULING_CACHE_TTL_MS)
        ? Promise.resolve()
        : api
            .get("/scheduling/classes", {
              params: {
                from: `${weekStartKey}T00:00:00.000Z`,
                to: `${weekEndKey}T23:59:59.999Z`
              }
            })
            .then((res) => {
              if (!cancelled) writePageCache(scheduleCacheKey, res.data);
            })
            .catch(() => {});

    void Promise.all([warmDashboard, warmCoaches, warmSchedule]);

    return () => {
      cancelled = true;
    };
  }, [authed]);

  const handleLogout = useCallback(async () => {
    clearCachedAuthToken();
    await supabase.auth.signOut();
    setAuthed(false);
    navigate("/login");
  }, [navigate]);

  if (loading) {
    return <BrandedSplash title="Ukali Admin" subtitle="Loading your dashboard..." />;
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
          <Route path="scheduling" element={<SchedulingPage />} />
          <Route path="classes" element={<Navigate to="/scheduling" replace />} />
          <Route path="coaching-schedule" element={<Navigate to="/scheduling" replace />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<LoginPage onLogin={() => setAuthed(true)} />} />
      )}
    </Routes>
  );
}
