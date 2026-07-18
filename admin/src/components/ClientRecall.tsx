import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { isPageCacheFresh, readPageCache, writePageCache } from "../lib/pageCache";
import {
  ADMIN_MEMBERS_CACHE_KEY,
  ADMIN_MEMBERS_TTL_MS,
  MEMBER_OPTIONS_CACHE_KEY,
  PAYMENTS_BOOTSTRAP_TTL_MS
} from "../lib/adminWarmups";

type ClientRecord = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  age?: number | null;
  fitnessGoals?: string | null;
  role?: "ADMIN" | "MEMBER";
  paymentStatus?: "PAID" | "UNPAID";
  membershipStatus?: string;
  nextPaymentDue?: string | null;
  daysLeftInMembership?: number;
  classesTotalAttended?: number;
  workoutStreak?: number;
  inviteAcceptedAt?: string | null;
  lastLoginAt?: string | null;
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

type WorkoutLogRecord = {
  id: string;
  checkedInAt: string;
  weight?: string | null;
  completionTime?: string | null;
  movementScales?: string | null;
  coachNotes?: string | null;
  class?: {
    title?: string | null;
    datetime?: string | null;
  } | null;
  workout?: {
    date?: string | null;
    description?: string | null;
  } | null;
};

const PAYMENT_HISTORY_CACHE_PREFIX = "payment-history:";
const WORKOUT_HISTORY_CACHE_PREFIX = "workout-history:";
const CLIENT_HISTORY_TTL_MS = 2 * 60 * 1000;
const MAX_RESULTS = 6;

function normalizeSearch(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function mergeClients(primary: ClientRecord[], fallback: ClientRecord[]) {
  const clientsById = new Map<string, ClientRecord>();
  for (const client of fallback) clientsById.set(client.id, client);
  for (const client of primary) {
    clientsById.set(client.id, {
      ...clientsById.get(client.id),
      ...client
    });
  }
  return Array.from(clientsById.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default function ClientRecall() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogRecord[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cachedMembers = readPageCache<ClientRecord[]>(ADMIN_MEMBERS_CACHE_KEY);
    const cachedOptions = readPageCache<ClientRecord[]>(MEMBER_OPTIONS_CACHE_KEY);

    if (cachedMembers || cachedOptions) {
      setClients(mergeClients(cachedMembers?.data || [], cachedOptions?.data || []));
    }

    const membersFresh = cachedMembers && isPageCacheFresh(cachedMembers.savedAt, ADMIN_MEMBERS_TTL_MS);
    const optionsFresh = cachedOptions && isPageCacheFresh(cachedOptions.savedAt, PAYMENTS_BOOTSTRAP_TTL_MS);
    if (membersFresh || optionsFresh) return () => {
      cancelled = true;
    };

    (async () => {
      setLoadingClients(!cachedMembers && !cachedOptions);
      try {
        const res = await api.get("/users");
        if (cancelled) return;
        const nextClients = res.data as ClientRecord[];
        setClients(nextClients);
        writePageCache(ADMIN_MEMBERS_CACHE_KEY, nextClients);
      } catch {
        if (!cancelled && !cachedMembers && !cachedOptions) {
          setErrorMessage("Client search is warming up. Try again in a moment.");
        }
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedClient) {
      setPayments([]);
      setWorkoutLogs([]);
      setLoadingHistory(false);
      return;
    }

    let cancelled = false;
    const paymentCacheKey = `${PAYMENT_HISTORY_CACHE_PREFIX}${selectedClient.id}`;
    const workoutCacheKey = `${WORKOUT_HISTORY_CACHE_PREFIX}${selectedClient.id}`;
    const cachedPayments = readPageCache<PaymentRecord[]>(paymentCacheKey);
    const cachedWorkoutLogs = readPageCache<WorkoutLogRecord[]>(workoutCacheKey);

    if (cachedPayments) setPayments(cachedPayments.data);
    if (cachedWorkoutLogs) setWorkoutLogs(cachedWorkoutLogs.data);

    const paymentsFresh = cachedPayments && isPageCacheFresh(cachedPayments.savedAt, CLIENT_HISTORY_TTL_MS);
    const workoutsFresh = cachedWorkoutLogs && isPageCacheFresh(cachedWorkoutLogs.savedAt, CLIENT_HISTORY_TTL_MS);
    if (paymentsFresh && workoutsFresh) return () => {
      cancelled = true;
    };

    (async () => {
      setLoadingHistory(!cachedPayments || !cachedWorkoutLogs);
      setErrorMessage(null);
      const [paymentResult, workoutResult] = await Promise.allSettled([
        paymentsFresh ? Promise.resolve({ data: cachedPayments!.data }) : api.get(`/users/${selectedClient.id}/payments`),
        workoutsFresh ? Promise.resolve({ data: cachedWorkoutLogs!.data }) : api.get(`/users/${selectedClient.id}/workout-logs`)
      ]);

      if (cancelled) return;

      if (paymentResult.status === "fulfilled") {
        const nextPayments = paymentResult.value.data as PaymentRecord[];
        setPayments(nextPayments);
        writePageCache(paymentCacheKey, nextPayments);
      }

      if (workoutResult.status === "fulfilled") {
        const nextWorkoutLogs = workoutResult.value.data as WorkoutLogRecord[];
        setWorkoutLogs(nextWorkoutLogs);
        writePageCache(workoutCacheKey, nextWorkoutLogs);
      }

      if (paymentResult.status === "rejected" || workoutResult.status === "rejected") {
        setErrorMessage("Could not load the full client history.");
      }
      setLoadingHistory(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedClient]);

  const results = useMemo(() => {
    const search = normalizeSearch(query);
    if (!search) return [];

    return clients
      .filter((client) => {
        const haystack = [
          client.name,
          client.email,
          client.phone,
          client.fitnessGoals
        ].map(normalizeSearch).join(" ");
        return haystack.includes(search);
      })
      .slice(0, MAX_RESULTS);
  }, [clients, query]);

  const handleSelectClient = (client: ClientRecord) => {
    setSelectedClient(client);
    setQuery(client.name);
    setOpen(true);
  };

  return (
    <div
      className="client-recall"
      ref={shellRef}
      onBlur={(event) => {
        if (!shellRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <label className="client-recall-search">
        <span className="client-recall-icon" aria-hidden="true">⌕</span>
        <input
          className="client-recall-input"
          type="search"
          placeholder="Search clients by name, email, or phone"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedClient(null);
            setOpen(true);
            setErrorMessage(null);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
      </label>

      {open ? (
        <div className="client-recall-panel">
          {query.trim() && !selectedClient ? (
            <div className="client-recall-results">
              {loadingClients ? <p className="client-recall-muted">Loading clients...</p> : null}
              {!loadingClients && results.length === 0 ? (
                <p className="client-recall-muted">No clients found.</p>
              ) : null}
              {results.map((client) => (
                <button
                  className="client-recall-result"
                  key={client.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelectClient(client)}
                >
                  <span>
                    <strong>{client.name}</strong>
                    <small>{client.email}{client.phone ? ` · ${client.phone}` : ""}</small>
                  </span>
                  <em>{client.paymentStatus || "UNPAID"}</em>
                </button>
              ))}
            </div>
          ) : null}

          {selectedClient ? (
            <div className="client-recall-history">
              <div className="client-recall-history-header">
                <div>
                  <strong>{selectedClient.name}</strong>
                  <span>{selectedClient.email}</span>
                </div>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setSelectedClient(null)}>
                  Change
                </button>
              </div>

              <div className="client-recall-summary">
                <span><strong>{selectedClient.membershipStatus || selectedClient.paymentStatus || "UNPAID"}</strong> Status</span>
                <span><strong>{selectedClient.daysLeftInMembership ?? 0}</strong> Days left</span>
                <span><strong>{selectedClient.classesTotalAttended ?? 0}</strong> Classes</span>
                <span><strong>{selectedClient.workoutStreak ?? 0}</strong> Streak</span>
              </div>

              {errorMessage ? <p className="client-recall-error">{errorMessage}</p> : null}
              {loadingHistory ? <p className="client-recall-muted">Loading client history...</p> : null}

              <div className="client-recall-history-grid">
                <section>
                  <h4>Payments</h4>
                  {payments.length === 0 && !loadingHistory ? <p className="client-recall-muted">No payments recorded.</p> : null}
                  {payments.slice(0, 5).map((payment) => (
                    <div className="client-recall-history-row" key={payment.id}>
                      <span>{formatDate(payment.date)}</span>
                      <strong>{payment.amount} NPR</strong>
                      <small>{payment.planName || payment.method}</small>
                    </div>
                  ))}
                </section>

                <section>
                  <h4>Workouts</h4>
                  {workoutLogs.length === 0 && !loadingHistory ? <p className="client-recall-muted">No workout history yet.</p> : null}
                  {workoutLogs.slice(0, 5).map((log) => (
                    <div className="client-recall-history-row" key={log.id}>
                      <span>{formatDate(log.checkedInAt)}</span>
                      <strong>{log.class?.title || "Class check-in"}</strong>
                      <small>{log.completionTime || log.weight || log.movementScales || log.workout?.description || "Logged"}</small>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          ) : null}

          {!query.trim() && !selectedClient ? (
            <p className="client-recall-muted">Type to find a client and pull up their history.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
