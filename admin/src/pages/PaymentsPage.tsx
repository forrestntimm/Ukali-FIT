import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { isPageCacheFresh, readPageCache, writePageCache } from "../lib/pageCache";
import {
  MEMBER_OPTIONS_CACHE_KEY,
  PAYMENT_INCOME_CACHE_KEY,
  PAYMENT_INCOME_TTL_MS,
  PAYMENT_PLANS_CACHE_KEY,
  PAYMENTS_BOOTSTRAP_TTL_MS
} from "../lib/adminWarmups";

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

type IncomeReport = {
  generatedAt: string;
  currency: "NPR";
  totals: {
    today: number;
    week: number;
    month: number;
    year: number;
    allTime: number;
  };
  counts: {
    successfulPayments: number;
    unpaidMembers: number;
  };
  byMethod: Array<{
    method: string;
    total: number;
    count: number;
  }>;
  byPlan: Array<{
    planCode: string;
    planName: string;
    total: number;
    count: number;
    quantity: number;
  }>;
  recentPayments: Array<PaymentRecord & {
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  unpaidMembers: Array<{
    id: string;
    name: string;
    email: string;
    paymentStatus: "PAID" | "UNPAID";
    nextPaymentDue?: string | null;
  }>;
};

const PAYMENT_HISTORY_CACHE_PREFIX = "payment-history:";
const PAYMENT_HISTORY_TTL_MS = 2 * 60 * 1000;
const currencyFormatter = new Intl.NumberFormat("en-NP", {
  maximumFractionDigits: 0
});

function formatNpr(amount: number) {
  return `NPR ${currencyFormatter.format(amount || 0)}`;
}

function formatMethod(method: string) {
  return method.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (value) => value.toUpperCase());
}

export default function PaymentsPage() {
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [incomeReport, setIncomeReport] = useState<IncomeReport | null>(null);
  const [form, setForm] = useState({ userId: "", planCode: "", quantity: "1" });
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingIncome, setLoadingIncome] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === form.userId),
    [members, form.userId]
  );
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === form.planCode) || null,
    [plans, form.planCode]
  );
  const normalizedQuantity = selectedPlan?.quantityEnabled ? Math.max(1, Number(form.quantity) || 1) : 1;
  const previewAmount = selectedPlan ? selectedPlan.amount * normalizedQuantity : 0;

  const fetchIncomeReport = useCallback(async (options: { force?: boolean } = {}) => {
    const cachedIncome = readPageCache<IncomeReport>(PAYMENT_INCOME_CACHE_KEY);
    if (!options.force && cachedIncome) {
      setIncomeReport(cachedIncome.data);
      if (isPageCacheFresh(cachedIncome.savedAt, PAYMENT_INCOME_TTL_MS)) return cachedIncome.data;
    }

    if (!cachedIncome) setLoadingIncome(true);
    try {
      const res = await api.get("/payments/income");
      const report = res.data as IncomeReport;
      setIncomeReport(report);
      writePageCache(PAYMENT_INCOME_CACHE_KEY, report);
      return report;
    } finally {
      setLoadingIncome(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const cachedUsers = readPageCache<MemberOption[]>(MEMBER_OPTIONS_CACHE_KEY);
    const cachedPlans = readPageCache<PaymentPlan[]>(PAYMENT_PLANS_CACHE_KEY);
    const cachedIncome = readPageCache<IncomeReport>(PAYMENT_INCOME_CACHE_KEY);

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
    if (cachedIncome) {
      setIncomeReport(cachedIncome.data);
      setLoadingIncome(false);
    }

    const usersFresh = cachedUsers && isPageCacheFresh(cachedUsers.savedAt, PAYMENTS_BOOTSTRAP_TTL_MS);
    const plansFresh = cachedPlans && isPageCacheFresh(cachedPlans.savedAt, PAYMENTS_BOOTSTRAP_TTL_MS);
    const incomeFresh = cachedIncome && isPageCacheFresh(cachedIncome.savedAt, PAYMENT_INCOME_TTL_MS);
    if (usersFresh && plansFresh && incomeFresh) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      if (!cachedUsers) setLoadingMembers(true);
      if (!cachedPlans) setLoadingPlans(true);
      if (!cachedIncome) setLoadingIncome(true);
      try {
        const [usersResult, plansResult, incomeResult] = await Promise.allSettled([
          usersFresh ? Promise.resolve({ data: cachedUsers!.data }) : api.get("/users/member-options"),
          plansFresh ? Promise.resolve({ data: cachedPlans!.data }) : api.get("/payments/plans"),
          incomeFresh ? Promise.resolve({ data: cachedIncome!.data }) : api.get("/payments/income")
        ]);

        if (cancelled) return;

        let nextError: string | null = null;

        if (usersResult.status === "fulfilled") {
          const users = usersResult.value.data as MemberOption[];
          setMembers(users);
          if (!usersFresh) writePageCache(MEMBER_OPTIONS_CACHE_KEY, usersResult.value.data as MemberOption[]);
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

        if (incomeResult.status === "fulfilled") {
          const report = incomeResult.value.data as IncomeReport;
          setIncomeReport(report);
          if (!incomeFresh) writePageCache(PAYMENT_INCOME_CACHE_KEY, report);
        } else {
          nextError = incomeResult.reason?.response?.data?.message || "Could not load income tracking.";
        }

        setErrorMessage(nextError);
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
          setLoadingPlans(false);
          setLoadingIncome(false);
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

      const [usersRes, paymentsRes, incomeRes] = await Promise.all([
        api.get("/users/member-options"),
        api.get(`/users/${form.userId}/payments`),
        api.get("/payments/income")
      ]);
      const athleteMembers = usersRes.data as MemberOption[];
      const paymentHistory = paymentsRes.data as PaymentRecord[];
      const report = incomeRes.data as IncomeReport;
      setMembers(athleteMembers);
      setPayments(paymentHistory);
      setIncomeReport(report);
      writePageCache(MEMBER_OPTIONS_CACHE_KEY, usersRes.data);
      writePageCache(`${PAYMENT_HISTORY_CACHE_PREFIX}${form.userId}`, paymentHistory);
      writePageCache(PAYMENT_INCOME_CACHE_KEY, report);
      setStatusMessage(`Payment recorded for ${selectedMember?.name || "athlete"}.`);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Income Tracking</span>
          <h1>Payments</h1>
        </div>
        <button className="secondary-btn" type="button" onClick={() => fetchIncomeReport({ force: true })}>
          {loadingIncome ? "Refreshing..." : "Refresh Income"}
        </button>
      </div>

      <section className="income-summary-grid" aria-label="Income summary">
        <div className="income-card">
          <span>Today</span>
          <strong>{formatNpr(incomeReport?.totals.today || 0)}</strong>
        </div>
        <div className="income-card">
          <span>This Week</span>
          <strong>{formatNpr(incomeReport?.totals.week || 0)}</strong>
        </div>
        <div className="income-card accent">
          <span>This Month</span>
          <strong>{formatNpr(incomeReport?.totals.month || 0)}</strong>
        </div>
        <div className="income-card">
          <span>This Year</span>
          <strong>{formatNpr(incomeReport?.totals.year || 0)}</strong>
        </div>
        <div className="income-card">
          <span>All Time</span>
          <strong>{formatNpr(incomeReport?.totals.allTime || 0)}</strong>
        </div>
        <div className="income-card warning">
          <span>Outstanding Members</span>
          <strong>{incomeReport?.counts.unpaidMembers || 0}</strong>
        </div>
      </section>

      <div className="payments-dashboard-grid">
        <section className="card income-panel">
          <div className="section-title-row">
            <div>
              <h3>Collected Income</h3>
              <p>{incomeReport ? `${incomeReport.counts.successfulPayments} completed payments recorded.` : "Loading income totals..."}</p>
            </div>
          </div>

          <div className="income-split-grid">
            <div>
              <h4>By Payment Method</h4>
              <div className="income-bars">
                {(incomeReport?.byMethod.length ? incomeReport.byMethod : [{ method: "CASH", total: 0, count: 0 }]).map((item) => {
                  const max = Math.max(...(incomeReport?.byMethod.map((method) => method.total) || [1]), 1);
                  return (
                    <div className="income-bar-row" key={item.method}>
                      <div>
                        <strong>{formatMethod(item.method)}</strong>
                        <span>{item.count} payments</span>
                      </div>
                      <div className="income-bar-track" aria-hidden="true">
                        <span style={{ width: `${Math.max(8, (item.total / max) * 100)}%` }} />
                      </div>
                      <b>{formatNpr(item.total)}</b>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4>Top Plans</h4>
              <div className="income-mini-table">
                {(incomeReport?.byPlan.slice(0, 6) || []).map((plan) => (
                  <div className="income-mini-row" key={plan.planCode}>
                    <span>{plan.planName}</span>
                    <strong>{formatNpr(plan.total)}</strong>
                    <small>{plan.quantity} sold</small>
                  </div>
                ))}
                {incomeReport && incomeReport.byPlan.length === 0 ? (
                  <p className="muted-text">No successful payments recorded yet.</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="card income-panel">
          <div className="section-title-row">
            <div>
              <h3>Recent Payments</h3>
              <p>Newest successful payments across all athletes.</p>
            </div>
          </div>
          <div className="income-mini-table">
            {(incomeReport?.recentPayments || []).map((payment) => (
              <div className="income-mini-row" key={payment.id}>
                <span>{payment.user.name}</span>
                <strong>{formatNpr(payment.amount)}</strong>
                <small>{payment.planName || "Payment"} · {new Date(payment.date).toLocaleDateString()}</small>
              </div>
            ))}
            {incomeReport && incomeReport.recentPayments.length === 0 ? (
              <p className="muted-text">No payments recorded yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="payments-workflow-grid">
        <div className="card payment-entry-card">
          <h3>Record Cash Payment</h3>
        {loadingMembers || loadingPlans ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>Loading athletes and payment options...</p>
        ) : null}
        <form className="payment-entry-form" onSubmit={submit}>
          <select value={form.userId} onChange={(e) => setForm((current) => ({ ...current, userId: e.target.value }))}>
            <option value="">Select athlete</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>

          <select
            value={form.planCode}
            onChange={(e) => setForm((current) => ({ ...current, planCode: e.target.value, quantity: "1" }))}
          >
            <option value="">Select payment option</option>
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name} - {plan.amount} {plan.currency}
              </option>
            ))}
          </select>

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

        <div className="card payment-history-card">
          <h3 style={{ marginTop: 0 }}>
            {selectedMember ? `Payment History - ${selectedMember.name}` : "Outstanding Members"}
          </h3>
          {selectedMember ? (
            <>
              {loadingPayments ? <p style={{ color: "#94a3b8" }}>Loading payment history...</p> : null}
              {payments.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>No payments recorded yet.</p>
              ) : (
                <div className="table-wrap">
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
                          <td>{formatNpr(payment.amount)}</td>
                          <td>{payment.status}</td>
                          <td>{formatMethod(payment.method)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="income-mini-table">
              {(incomeReport?.unpaidMembers || []).map((member) => (
                <div className="income-mini-row" key={member.id}>
                  <span>{member.name}</span>
                  <strong>{member.paymentStatus}</strong>
                  <small>{member.email}</small>
                </div>
              ))}
              {incomeReport && incomeReport.unpaidMembers.length === 0 ? (
                <p className="muted-text">No outstanding members right now.</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
