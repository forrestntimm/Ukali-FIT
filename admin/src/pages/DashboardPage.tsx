import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { isPageCacheFresh, readPageCache, writePageCache } from "../lib/pageCache";
import { DASHBOARD_STATS_CACHE_KEY, DASHBOARD_STATS_TTL_MS } from "../lib/adminWarmups";

type DashboardStats = {
  members: number;
  overdue: number;
  upcoming: number;
  activeCoaches: number;
  totalCheckIns: number;
  totalWorkoutLogs: number;
  totalCoachSessions: number;
  scheduledClasses: number;
  activity: DashboardActivityPoint[];
};

type DashboardActivityPoint = {
  dateKey: string;
  label: string;
  athleteCheckIns: number;
  workoutLogs: number;
  coachSessions: number;
  scheduledClasses: number;
  total: number;
};

const EMPTY_DASHBOARD_STATS: DashboardStats = {
  members: 0,
  overdue: 0,
  upcoming: 0,
  activeCoaches: 0,
  totalCheckIns: 0,
  totalWorkoutLogs: 0,
  totalCoachSessions: 0,
  scheduledClasses: 0,
  activity: []
};

function normalizeDashboardStats(input: Partial<DashboardStats>): DashboardStats {
  return {
    ...EMPTY_DASHBOARD_STATS,
    ...input,
    activity: Array.isArray(input.activity) ? input.activity : []
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_DASHBOARD_STATS);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cachedStats = readPageCache<DashboardStats>(DASHBOARD_STATS_CACHE_KEY);

    if (cachedStats) {
      setStats(normalizeDashboardStats(cachedStats.data));
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
        const nextStats = normalizeDashboardStats(members.data as Partial<DashboardStats>);
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

  const activity = stats.activity.length > 0 ? stats.activity : [];
  const maxActivityTotal = Math.max(1, ...activity.map((point) => point.total));

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Ukali Fit</span>
          <h1>Dashboard</h1>
        </div>
        <span className="page-status">Today’s operating view</span>
      </div>
      {loading ? <p style={{ color: "var(--muted)" }}>Loading dashboard...</p> : null}
      {errorMessage ? <p style={{ color: "var(--danger)" }}>{errorMessage}</p> : null}
      <div className="dashboard-layout">
        <section className="dashboard-main">
          <div className="metric-grid">
            <article className="metric-card">
              <span className="metric-label">Current Members</span>
              <strong>{stats.members}</strong>
              <span className="metric-note">Active athlete profiles</span>
            </article>
            <article className="metric-card">
              <span className="metric-label">Active Coaches</span>
              <strong>{stats.activeCoaches}</strong>
              <span className="metric-note">Admin coach accounts</span>
            </article>
            <article className="metric-card">
              <span className="metric-label">Athlete Check-ins</span>
              <strong>{stats.totalCheckIns}</strong>
              <span className="metric-note">Collected from app check-ins</span>
            </article>
          </div>

          <div className="card chart-card">
            <div className="section-title-row">
              <div>
                <h3>Gym Activity</h3>
                <p>Live rollup from athlete check-ins, workout logs, coach sessions, and scheduled classes.</p>
              </div>
              <span className="badge success">Live</span>
            </div>
            <div className="activity-chart" aria-label="Eight day gym activity chart">
              {activity.map((point) => (
                <div className="activity-bar-group" key={point.dateKey}>
                  <span
                    className="activity-bar"
                    style={{ height: `${Math.max(10, Math.round((point.total / maxActivityTotal) * 100))}%` }}
                    title={`${point.label}: ${point.total} total activity events`}
                  />
                  <small>{point.label}</small>
                </div>
              ))}
            </div>
            <div className="activity-legend">
              <span>Athlete check-ins: {stats.totalCheckIns}</span>
              <span>Workout logs: {stats.totalWorkoutLogs}</span>
              <span>Coach sessions: {stats.totalCoachSessions}</span>
              <span>Scheduled classes: {stats.scheduledClasses}</span>
            </div>
          </div>
        </section>

        <aside className="dashboard-aside">
          <div className="card target-card">
            <span className="metric-label">Membership Target</span>
            <div className="target-ring">
              <strong>{stats.members}</strong>
              <span>members</span>
            </div>
            <p>Keep invites, payment follow-ups, and coaching assignments moving from the tabs.</p>
          </div>
          <div className="card ops-card">
            <h3>Payments</h3>
            <div className="mini-stat-row">
              <span>Unpaid</span>
              <strong>{stats.overdue}</strong>
            </div>
            <div className="mini-stat-row">
              <span>Renewals due</span>
              <strong>{stats.upcoming}</strong>
            </div>
          </div>
          <div className="card ops-card">
            <h3>Quick Ops</h3>
            <Link to="/members">Invite members</Link>
            <Link to="/payments">Record payments</Link>
            <Link to="/scheduling">Assign coaches</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
