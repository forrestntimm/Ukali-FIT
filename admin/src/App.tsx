import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { NavLink, Route, Routes, useNavigate, Outlet, Navigate, useLocation } from "react-router-dom";
import BrandedSplash from "./components/BrandedSplash";
import ClientRecall from "./components/ClientRecall";
import { api } from "./api/client";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { Session } from "@supabase/supabase-js";
import axios from "axios";
import { shouldRouteToDashboardAfterAuth } from "./utils/auth-navigation";
import { clearCachedAuthToken, primeCachedAuthTokenFromStorage, setCachedAuthToken } from "./lib/authTokenCache";
import {
  warmAllAdminTabData,
  warmAnnouncementsData,
  warmDashboardData,
  warmMembersData,
  warmPaymentsData,
  warmSchedulingData,
  warmWorkoutsData
} from "./lib/adminWarmups";
import wallpaperLogo from "./assets/wallpaper-logo.png";

const loadDashboardPage = () => import("./pages/DashboardPage");
const loadMembersPage = () => import("./pages/MembersPage");
const loadPaymentsPage = () => import("./pages/PaymentsPage");
const loadWodPage = () => import("./pages/WodPage");
const loadSchedulingPage = () => import("./pages/SchedulingPage");
const loadAnnouncementsPage = () => import("./pages/AnnouncementsPage");
const loadLoginPage = () => import("./pages/LoginPage");
const DashboardPage = lazy(loadDashboardPage);
const MembersPage = lazy(loadMembersPage);
const PaymentsPage = lazy(loadPaymentsPage);
const WodPage = lazy(loadWodPage);
const SchedulingPage = lazy(loadSchedulingPage);
const AnnouncementsPage = lazy(loadAnnouncementsPage);
const LoginPage = lazy(loadLoginPage);
const ADMIN_NAV_ITEMS = [
  { to: "/", label: "Dashboard", preload: loadDashboardPage, warmData: warmDashboardData },
  { to: "/members", label: "Members", preload: loadMembersPage, warmData: warmMembersData },
  { to: "/payments", label: "Payments", preload: loadPaymentsPage, warmData: warmPaymentsData },
  { to: "/wod", label: "WOD", preload: loadWodPage, warmData: warmWorkoutsData },
  { to: "/scheduling", label: "Scheduling", preload: loadSchedulingPage, warmData: warmSchedulingData },
  { to: "/announcements", label: "Announcements", preload: loadAnnouncementsPage, warmData: warmAnnouncementsData }
];

function preloadAdminTab(preload: () => Promise<unknown>, warmData: () => Promise<void>) {
  void preload();
  void warmData();
}

function RouteFallback() {
  return (
    <div className="page">
      <p style={{ color: "var(--muted)" }}>Loading...</p>
    </div>
  );
}

function Layout({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const currentItem = ADMIN_NAV_ITEMS.find((item) => {
    if (item.to === "/") return location.pathname === "/";
    return location.pathname.startsWith(item.to);
  });
  const currentLabel = currentItem?.label || "Dashboard";

  return (
    <div className="main-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">
            <img src={wallpaperLogo} alt="" />
          </span>
          <span>
            <span className="logo">Ukali</span>
            <span className="logo-subtitle">Admin Console</span>
          </span>
        </div>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              className="nav-link"
              to={item.to}
              onFocus={() => preloadAdminTab(item.preload, item.warmData)}
              onMouseEnter={() => preloadAdminTab(item.preload, item.warmData)}
            >
              <span className="nav-link-icon" aria-hidden="true">{item.label.slice(0, 1)}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-plan">
          <span className="sidebar-plan-label">Live Gym Ops</span>
          <strong>Performance Mode</strong>
          <span>Data warms in the background so each tab opens fast.</span>
        </div>
        <button className="secondary-btn sidebar-logout" onClick={onLogout}>Sign Out</button>
      </aside>
      <main>
        <div className="topbar">
          <div>
            <span className="topbar-kicker">Admin Console</span>
            <strong className="topbar-title">{currentLabel}</strong>
          </div>
          <div className="topbar-actions">
            <ClientRecall />
            <span className="security-pill">secure</span>
            <span className="admin-avatar" aria-hidden="true">U</span>
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

    const restoreSupabaseSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return false;

      if (data.session) {
        await completeSupabaseLogin(data.session);
        return true;
      }

      return false;
    };

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
          if (mounted) {
            const restored = await restoreSupabaseSession();
            if (!restored) setLoading(false);
          }
        }
        return;
      }

      const restored = await restoreSupabaseSession();
      if (!restored && mounted) setLoading(false);
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
    void warmAllAdminTabData({
      shouldWrite: () => !cancelled
    });

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
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
  );
}
