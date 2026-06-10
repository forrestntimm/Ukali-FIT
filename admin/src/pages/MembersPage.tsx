import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { isPageCacheFresh, readPageCache, writePageCache } from "../lib/pageCache";
import { extractRetryAfterSeconds, getSecondsRemaining } from "../utils/rate-limit";

const USERS_CACHE_KEY = "admin-users";
const USERS_CACHE_TTL_MS = 2 * 60 * 1000;

export default function MembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", age: "", fitnessGoals: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteCooldownUntilMs, setInviteCooldownUntilMs] = useState<number | null>(null);
  const [resendingByUserId, setResendingByUserId] = useState<Record<string, boolean>>({});
  const [resendCooldownUntilByUserId, setResendCooldownUntilByUserId] = useState<Record<string, number>>({});
  const [approvingByUserId, setApprovingByUserId] = useState<Record<string, boolean>>({});
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const memberAppRedirectTo = import.meta.env.VITE_MEMBER_APP_REDIRECT_URL?.trim() || "ukali://auth/callback";

  const load = async ({ force = false, background = false }: { force?: boolean; background?: boolean } = {}) => {
    const cachedMembers = readPageCache<any[]>(USERS_CACHE_KEY);

    if (!force && cachedMembers) {
      setMembers(cachedMembers.data);
      setError(null);
      if (isPageCacheFresh(cachedMembers.savedAt, USERS_CACHE_TTL_MS)) {
        setLoadingMembers(false);
        return;
      }
      background = true;
    }

    if (!background) setLoadingMembers(true);
    try {
      const res = await api.get("/users");
      const nextMembers = res.data as any[];
      setMembers(nextMembers);
      writePageCache(USERS_CACHE_KEY, nextMembers);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load members.");
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const inviteCooldownSeconds = getSecondsRemaining(inviteCooldownUntilMs, clockNowMs);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviting || inviteCooldownSeconds > 0) return;
    setMessage(null);
    setError(null);

    const normalizedName = form.name.trim();
    const normalizedEmail = form.email.trim().toLowerCase();
    const normalizedPhone = form.phone.trim();
    const normalizedGoals = form.fitnessGoals.trim();
    const normalizedAge = form.age ? Number(form.age) : undefined;

    if (!normalizedName || !normalizedEmail) {
      setError("Name and email are required.");
      return;
    }
    if (normalizedAge != null && (!Number.isInteger(normalizedAge) || normalizedAge < 1 || normalizedAge > 120)) {
      setError("Age must be a whole number between 1 and 120.");
      return;
    }

    setInviting(true);

    try {
      await api.post("/users/invite", {
        name: normalizedName,
        email: normalizedEmail,
        phone: normalizedPhone || undefined,
        age: normalizedAge,
        fitnessGoals: normalizedGoals || undefined,
        role: "MEMBER",
        redirectTo: memberAppRedirectTo
      });
      setForm({ name: "", email: "", phone: "", age: "", fitnessGoals: "" });
      setInviteCooldownUntilMs(null);
      setMessage("Invite sent successfully.");
      await load({ force: true });
    } catch (err: any) {
      const apiCode = err?.response?.data?.code;
      const apiMessage = err?.response?.data?.message || "Failed to send invite";
      const { seconds, derivedFromMessage } = extractRetryAfterSeconds(apiMessage, 60);

      if (apiCode === "INVITE_RATE_LIMITED" || derivedFromMessage) {
        setInviteCooldownUntilMs(Date.now() + seconds * 1000);
        setError(`Invite rate limited. Try again in ${seconds}s.`);
      } else {
        setError(apiMessage);
      }
    } finally {
      setInviting(false);
    }
  };

  const resendInvite = async (userId: string) => {
    const resendCooldownSeconds = getSecondsRemaining(resendCooldownUntilByUserId[userId], Date.now());
    if (resendingByUserId[userId] || resendCooldownSeconds > 0) return;

    setMessage(null);
    setError(null);
    setResendingByUserId((prev) => ({ ...prev, [userId]: true }));

    try {
      await api.post(`/users/${userId}/resend-invite?redirectTo=${encodeURIComponent(memberAppRedirectTo)}`);
      setResendCooldownUntilByUserId((prev) => {
        if (!(userId in prev)) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setMessage("Invite resent.");
      await load({ force: true, background: true });
    } catch (err: any) {
      const apiCode = err?.response?.data?.code;
      const apiMessage = err?.response?.data?.message || "Failed to resend invite";
      const { seconds, derivedFromMessage } = extractRetryAfterSeconds(apiMessage, 60);

      if (apiCode === "INVITE_RATE_LIMITED" || derivedFromMessage) {
        setResendCooldownUntilByUserId((prev) => ({ ...prev, [userId]: Date.now() + seconds * 1000 }));
        setError(`Resend rate limited. Try again in ${seconds}s.`);
      } else {
        setError(apiMessage);
      }
    } finally {
      setResendingByUserId((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const approveWebAccess = async (userId: string) => {
    if (approvingByUserId[userId]) return;

    setMessage(null);
    setError(null);
    setApprovingByUserId((prev) => ({ ...prev, [userId]: true }));
    try {
      await api.post(`/users/${userId}/approve-web-access`);
      setMessage("Web access approved.");
      await load({ force: true, background: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to approve web access.");
    } finally {
      setApprovingByUserId((prev) => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div className="page">
      <h1>Members</h1>
      <div className="grid grid-members">
        <div className="card">
          <h3>Invite Member</h3>
          <form style={{ display: "grid", gap: 12 }} onSubmit={invite}>
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Age" type="number" min={1} max={120} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            <input placeholder="Fitness goals" value={form.fitnessGoals} onChange={(e) => setForm({ ...form, fitnessGoals: e.target.value })} />
            <button className="primary-btn" type="submit" disabled={inviting || inviteCooldownSeconds > 0}>
              {inviting
                ? "Sending..."
                : inviteCooldownSeconds > 0
                ? `Retry in ${inviteCooldownSeconds}s`
                : "Send Invite"}
            </button>
            {inviteCooldownSeconds > 0 ? (
              <span style={{ color: "var(--muted)" }}>
                Invite cooldown active. You can send again in {inviteCooldownSeconds}s.
              </span>
            ) : null}
            {message ? <span style={{ color: "var(--primary-soft)" }}>{message}</span> : null}
            {error ? <span style={{ color: "var(--danger)" }}>{error}</span> : null}
          </form>
        </div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>All Members</h3>
            <button className="secondary-btn" type="button" onClick={() => void load({ force: true })} disabled={loadingMembers}>
              {loadingMembers ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {loadingMembers ? <p style={{ color: "var(--muted)" }}>Loading members...</p> : null}
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Goals</th>
                <th>Streak</th>
                <th>Classes</th>
                <th>Membership</th>
                <th>Status</th>
                <th>Days Left</th>
                <th>Next Due</th>
                <th>QR Code</th>
                <th>Web Access</th>
                <th>Invite</th>
                <th>Approval</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const resendCooldownSeconds = getSecondsRemaining(resendCooldownUntilByUserId[m.id], clockNowMs);
                const isResending = Boolean(resendingByUserId[m.id]);
                const isApproving = Boolean(approvingByUserId[m.id]);

                return (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.age ?? "-"}</td>
                    <td>{m.fitnessGoals || "-"}</td>
                    <td>{m.workoutStreak ?? 0}</td>
                    <td>{m.classesTotalAttended ?? 0}</td>
                    <td>{m.membershipStatus}</td>
                    <td>
                      <span className={`badge ${m.paymentStatus === "PAID" ? "success" : "danger"}`}>
                        {m.paymentStatus}
                      </span>
                    </td>
                    <td>{m.daysLeftInMembership ?? 0}</td>
                    <td>{m.nextPaymentDue ? new Date(m.nextPaymentDue).toLocaleDateString() : "-"}</td>
                    <td><code>{m.checkInQrCode || "-"}</code></td>
                    <td>
                      <span className={`badge ${m.webAccessApproved ? "success" : "danger"}`}>
                        {m.webAccessApproved ? "APPROVED" : "PENDING"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={() => resendInvite(m.id)}
                        disabled={isResending || resendCooldownSeconds > 0}
                      >
                        {isResending
                          ? "Resending..."
                          : resendCooldownSeconds > 0
                          ? `Retry in ${resendCooldownSeconds}s`
                          : "Resend"}
                      </button>
                    </td>
                    <td>
                      {m.webAccessApproved ? (
                        <span style={{ color: "var(--muted)" }}>
                          {m.webAccessApprovedBy?.name ? `By ${m.webAccessApprovedBy.name}` : "Approved"}
                        </span>
                      ) : (
                        <button
                          className="secondary-btn"
                          type="button"
                          onClick={() => approveWebAccess(m.id)}
                          disabled={isApproving}
                        >
                          {isApproving ? "Approving..." : "Approve"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
