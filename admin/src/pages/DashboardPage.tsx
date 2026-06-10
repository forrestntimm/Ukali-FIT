import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { isPageCacheFresh, readPageCache, writePageCache } from "../lib/pageCache";

const DASHBOARD_STATS_CACHE_KEY = "admin-dashboard-stats";
const DASHBOARD_STATS_TTL_MS = 2 * 60 * 1000;

type DashboardStats = {
  members: number;
  overdue: number;
  upcoming: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ members: 0, overdue: 0, upcoming: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cachedStats = readPageCache<DashboardStats>(DASHBOARD_STATS_CACHE_KEY);

    if (cachedStats) {
      setStats(cachedStats.data);
      setLoading(false);
      if (isPageCacheFresh(cachedStats.savedAt, DASHBOARD_STATS_TTL_MS)) {
        return () => {
          cancelled = true;
        };
      }
    }

    (async () => {
      try {
        if (!cachedStats && !cancelled) setLoading(true);
        const members = await api.get("/users/stats");
        if (cancelled) return;
        const nextStats = members.data as DashboardStats;
        writePageCache(DASHBOARD_STATS_CACHE_KEY, nextStats);
        setStats(nextStats);
        setErrorMessage(null);
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(err?.response?.data?.message || "Could not load dashboard stats.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <h1>Dashboard</h1>
      {loading ? <p style={{ color: "var(--muted)" }}>Loading dashboard...</p> : null}
      {errorMessage ? <p style={{ color: "var(--danger)" }}>{errorMessage}</p> : null}
      <div className="grid grid-2">
        <div className="card">
          <h3>Total Members</h3>
          <p style={{ fontSize: 28 }}>{stats.members}</p>
        </div>
        <div className="card">
          <h3>Payments Unpaid</h3>
          <p style={{ fontSize: 28 }}>{stats.overdue}</p>
        </div>
      </div>
    </div>
  );
}
