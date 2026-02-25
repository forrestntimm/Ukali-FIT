import React, { useEffect, useState } from "react";
import { api } from "../api/client";

export default function MembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", age: "", fitnessGoals: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get("/users");
    setMembers(res.data);
  };

  useEffect(() => {
    void load();
  }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      await api.post("/users/invite", {
        ...form,
        age: form.age ? Number(form.age) : undefined,
        role: "MEMBER"
      });
      setForm({ name: "", email: "", phone: "", age: "", fitnessGoals: "" });
      setMessage("Invite sent successfully.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to send invite");
    }
  };

  const resendInvite = async (userId: string) => {
    setMessage(null);
    setError(null);

    try {
      await api.post(`/users/${userId}/resend-invite`);
      setMessage("Invite resent.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to resend invite");
    }
  };

  return (
    <div className="page">
      <h1>Members</h1>
      <div className="grid grid-2">
        <div className="card">
          <h3>Invite Member</h3>
          <form style={{ display: "grid", gap: 12 }} onSubmit={invite}>
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Age" type="number" min={1} max={120} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            <input placeholder="Fitness goals" value={form.fitnessGoals} onChange={(e) => setForm({ ...form, fitnessGoals: e.target.value })} />
            <button className="primary-btn" type="submit">Send Invite</button>
            {message ? <span style={{ color: "var(--primary-soft)" }}>{message}</span> : null}
            {error ? <span style={{ color: "var(--danger)" }}>{error}</span> : null}
          </form>
        </div>
        <div className="card">
          <h3>All Members</h3>
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
                <th>Invite</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
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
                    <button className="secondary-btn" type="button" onClick={() => resendInvite(m.id)}>
                      Resend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
