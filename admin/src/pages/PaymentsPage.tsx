import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { clearPageCache, isPageCacheFresh, readPageCache, writePageCache } from "../lib/pageCache";

type MemberOption = {
  id: string;
  name: string;
  role: "ADMIN" | "MEMBER";
  paymentStatus: "PAID" | "UNPAID";
  inviteAcceptedAt?: string | null;
  lastLoginAt?: string | null;
};

type PaymentPlan = {
  code: string;
  name: string;
  amount: number;
  currency: "NPR";
  description: string;
  quantityEnabled: boolean;
  category: "membership" | "per-class";
};

type PaymentRecord = {
  id: string;
  date: string;
  amount: number;
  method: string;
  status: string;
  planName?: string | null;
  quantity?: number;
};

const MEMBER_OPTIONS_CACHE_KEY = "admin-users";
const LEGACY_MEMBER_OPTIONS_CACHE_KEY = "admin-member-options";
const PAYMENT_PLANS_CACHE_KEY = "payment-plans";
const PAYMENT_HISTORY_CACHE_PREFIX = "payment-history:";
const PAYMENTS_BOOTSTRAP_TTL_MS = 5 * 60 * 1000;
const PAYMENT_HISTORY_TTL_MS = 2 * 60 * 1000;

export default function PaymentsPage() {
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [form, setForm] = useState({ userId: "", planCode: "", quantity: "1" });
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === form.userId),
    [members, form.userId]
  );
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === form.planCode) || null,
    [plans, form.planCode]
  );
  const membershipPlans = useMemo(
    () => plans.filter((plan) => plan.category === "membership"),
    [plans]
  );
  const perClassPlans = useMemo(
    () => plans.filter((plan) => plan.category === "per-class"),
    [plans]
  );
  const normalizedQuantity = selectedPlan?.quantityEnabled ? Math.max(1, Number(form.quantity) || 1) : 1;
  const previewAmount = selectedPlan ? selectedPlan.amount * normalizedQuantity : 0;

  useEffect(() => {
    let cancelled = false;

    const primaryCachedUsers = readPageCache<MemberOption[]>(MEMBER_OPTIONS_CACHE_KEY);
    const legacyCachedUsers = readPageCache<MemberOption[]>(LEGACY_MEMBER_OPTIONS_CACHE_KEY);
    const cachedUsers = primaryCachedUsers || legacyCachedUsers;
    const usingLegacyUsersCache = !primaryCachedUsers && Boolean(legacyCachedUsers);
    const cachedPlans = readPageCache<PaymentPlan[]>(PAYMENT_PLANS_CACHE_KEY);

    if (cachedUsers) {
      setMembers(cachedUsers.data);
      setLoadingMembers(false);
    }
    if (cachedPlans) {
      setPlans(cachedPlans.data);
      setForm((current) => ({
        ...current,
        planCode: current.planCode || cachedPlans.data[0]?.code || ""
      }));
      setLoadingPlans(false);
    }

    const usersFresh =
      !usingLegacyUsersCache &&
      cachedUsers &&
      isPageCacheFresh(cachedUsers.savedAt, PAYMENTS_BOOTSTRAP_TTL_MS);
    const plansFresh = cachedPlans && isPageCacheFresh(cachedPlans.savedAt, PAYMENTS_BOOTSTRAP_TTL_MS);
    if (usersFresh && plansFresh) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      if (!cachedUsers) setLoadingMembers(true);
      if (!cachedPlans) setLoadingPlans(true);
      try {
        const [usersResult, plansResult] = await Promise.allSettled([
          usersFresh ? Promise.resolve({ data: cachedUsers!.data }) : api.get("/users/member-options"),
          plansFresh ? Promise.resolve({ data: cachedPlans!.data }) : api.get("/payments/plans")
        ]);

        if (cancelled) return;

        let nextError: string | null = null;

        if (usersResult.status === "fulfilled") {
          const users = usersResult.value.data as MemberOption[];
          setMembers(users);
          if (!usersFresh) writePageCache(MEMBER_OPTIONS_CACHE_KEY, usersResult.value.data as MemberOption[]);
          clearPageCache(LEGACY_MEMBER_OPTIONS_CACHE_KEY);
        } else {
          nextError = usersResult.reason?.response?.data?.message || "Could not load athletes.";
        }

        if (plansResult.status === "fulfilled") {
          const paymentPlans = plansResult.value.data as PaymentPlan[];
          setPlans(paymentPlans);
          setForm((current) => ({
            ...current,
            planCode: current.planCode || paymentPlans[0]?.code || ""
          }));
          if (!plansFresh) writePageCache(PAYMENT_PLANS_CACHE_KEY, paymentPlans);
        } else {
          nextError = plansResult.reason?.response?.data?.message || "Could not load payment options.";
        }

        setErrorMessage(nextError);
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
          setLoadingPlans(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.userId) {
      setPayments([]);
      setLoadingPayments(false);
      setErrorMessage(null);
      setStatusMessage(null);
      return;
    }

    let cancelled = false;
    const historyCacheKey = `${PAYMENT_HISTORY_CACHE_PREFIX}${form.userId}`;
    const cachedPayments = readPageCache<PaymentRecord[]>(historyCacheKey);

    if (cachedPayments) {
      setPayments(cachedPayments.data);
      setLoadingPayments(false);
      if (isPageCacheFresh(cachedPayments.savedAt, PAYMENT_HISTORY_TTL_MS)) {
        return () => {
          cancelled = true;
        };
      }
    }

    (async () => {
      if (!cachedPayments) setLoadingPayments(true);
      setErrorMessage(null);
      try {
        const res = await api.get(`/users/${form.userId}/payments`);
        if (cancelled) return;
        setPayments(res.data);
        writePageCache(historyCacheKey, res.data);
      } catch (err: any) {
        if (cancelled) return;
        setPayments([]);
        setErrorMessage(err?.response?.data?.message || "Could not load payment history.");
      } finally {
        if (!cancelled) setLoadingPayments(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.userId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId) {
      setErrorMessage("Select an athlete first.");
      setStatusMessage(null);
      return;
    }

    if (!selectedPlan) {
      setErrorMessage("Select a payment option first.");
      setStatusMessage(null);
      return;
    }

    if (selectedPlan.quantityEnabled && (!Number.isFinite(normalizedQuantity) || normalizedQuantity < 1)) {
      setErrorMessage("Quantity must be at least 1.");
      setStatusMessage(null);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await api.post("/payments/manual", {
        userId: form.userId,
        planCode: selectedPlan.code,
        quantity: selectedPlan.quantityEnabled ? normalizedQuantity : 1
      });

      const [usersRes, paymentsRes] = await Promise.all([
        api.get("/users/member-options"),
        api.get(`/users/${form.userId}/payments`)
      ]);
      const athleteMembers = usersRes.data as MemberOption[];
      const paymentHistory = paymentsRes.data as PaymentRecord[];
      setMembers(athleteMembers);
      setPayments(paymentHistory);
      writePageCache(MEMBER_OPTIONS_CACHE_KEY, usersRes.data);
      writePageCache(`${PAYMENT_HISTORY_CACHE_PREFIX}${form.userId}`, paymentHistory);
      setStatusMessage(`Payment recorded for ${selectedMember?.name || "athlete"}.`);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <h1>Payments</h1>
      <div className="card" style={{ maxWidth: 520 }}>
        <h3>Record Cash Payment</h3>
        {loadingMembers || loadingPlans ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>Loading athletes and payment options...</p>
        ) : null}
        <form style={{ display: "grid", gap: 12 }} onSubmit={submit}>
          <select value={form.userId} onChange={(e) => setForm((current) => ({ ...current, userId: e.target.value }))}>
            <option value="">Select athlete</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>

          <div className="payment-plan-groups">
            <div className="payment-plan-group">
              <p className="payment-plan-group-title">Memberships</p>
              <div className="payment-plan-options">
                {membershipPlans.map((plan) => {
                  const isSelected = form.planCode === plan.code;
                  return (
                    <button
                      key={plan.code}
                      type="button"
                      className={`payment-plan-option${isSelected ? " active" : ""}`}
                      onClick={() => setForm((current) => ({ ...current, planCode: plan.code, quantity: "1" }))}
                    >
                      <span className="payment-plan-option-name">{plan.name}</span>
                      <span className="payment-plan-option-price">{plan.amount} {plan.currency}</span>
                      <span className="payment-plan-option-description">{plan.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="payment-plan-group">
              <p className="payment-plan-group-title">Per Class</p>
              <div className="payment-plan-options">
                {perClassPlans.map((plan) => {
                  const isSelected = form.planCode === plan.code;
                  return (
                    <button
                      key={plan.code}
                      type="button"
                      className={`payment-plan-option${isSelected ? " active" : ""}`}
                      onClick={() => setForm((current) => ({ ...current, planCode: plan.code, quantity: "1" }))}
                    >
                      <span className="payment-plan-option-name">{plan.name}</span>
                      <span className="payment-plan-option-price">{plan.amount} {plan.currency}</span>
                      <span className="payment-plan-option-description">{plan.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedPlan ? (
            <p style={{ margin: 0, color: "#94a3b8" }}>
              {selectedPlan.description}
            </p>
          ) : null}

          {selectedPlan?.quantityEnabled ? (
            <input
              type="number"
              min={1}
              step={1}
              placeholder="Quantity"
              value={form.quantity}
              onChange={(e) => setForm((current) => ({ ...current, quantity: e.target.value }))}
            />
          ) : null}

          {selectedPlan ? (
            <p style={{ margin: 0, color: "#94a3b8" }}>
              Selected plan: <strong>{selectedPlan.name}</strong> • Total: <strong>{previewAmount} NPR</strong>
            </p>
          ) : null}

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
        <div className="card" style={{ marginTop: 20, maxWidth: 820 }}>
          <h3 style={{ marginTop: 0 }}>Recent Payments - {selectedMember.name}</h3>
          {loadingPayments ? <p style={{ color: "#94a3b8" }}>Loading payment history...</p> : null}
          {payments.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No payments recorded yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plan</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.date).toLocaleDateString()}</td>
                    <td>{payment.planName || "-"}</td>
                    <td>{payment.quantity ?? 1}</td>
                    <td>{payment.amount} NPR</td>
                    <td>{payment.status}</td>
                    <td>{payment.method}</td>
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
