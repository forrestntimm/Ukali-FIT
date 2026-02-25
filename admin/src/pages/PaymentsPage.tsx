import React, { useEffect, useState } from "react";
import { api } from "../api/client";

export default function PaymentsPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: "", amount: 3000 });
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    api.get("/users").then((res) => setMembers(res.data));
  }, []);

  useEffect(() => {
    if (!form.userId) {
      setPayments([]);
      return;
    }

    api
      .get(`/users/${form.userId}/payments`)
      .then((res) => setPayments(res.data))
      .catch(() => setPayments([]));
  }, [form.userId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId) {
      setErrorMessage("Select a member first.");
      setStatusMessage(null);
      return;
    }
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) < 100) {
      setErrorMessage("Amount must be at least 100.");
      setStatusMessage(null);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await api.post("/payments/manual", { ...form, amount: Number(form.amount) });
      const selected = members.find((member) => member.id === form.userId);
      setStatusMessage(`Payment recorded for ${selected?.name || "member"}.`);
      const [usersRes, paymentsRes] = await Promise.all([api.get("/users"), api.get(`/users/${form.userId}/payments`)]);
      setMembers(usersRes.data);
      setPayments(paymentsRes.data);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMember = members.find((member) => member.id === form.userId);

  return (
    <div className="page">
      <h1>Payments</h1>
      <div className="card" style={{ maxWidth: 420 }}>
        <h3>Record Cash Payment</h3>
        <form style={{ display: "grid", gap: 12 }} onSubmit={submit}>
          <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
            <option value="">Select member</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input type="number" placeholder="Amount (NPR)" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          {selectedMember ? (
            <p style={{ margin: 0, color: "#94a3b8" }}>
              Current status: <strong>{selectedMember.paymentStatus}</strong>
            </p>
          ) : null}
          {statusMessage ? <p style={{ margin: 0, color: "#22c55e" }}>{statusMessage}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: "#ef4444" }}>{errorMessage}</p> : null}
          <button className="primary-btn" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Mark Paid"}
          </button>
        </form>
      </div>

      {selectedMember ? (
        <div className="card" style={{ marginTop: 20, maxWidth: 720 }}>
          <h3 style={{ marginTop: 0 }}>Recent Payments - {selectedMember.name}</h3>
          {payments.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No payments recorded yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.date).toLocaleString("en-NP", { timeZone: "Asia/Kathmandu" })}</td>
                    <td>{payment.amount}</td>
                    <td>{payment.method}</td>
                    <td>{payment.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
