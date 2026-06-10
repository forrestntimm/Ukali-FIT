import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { api } from "../api/client";
import { useStaleFocusRefresh } from "../hooks/useStaleFocusRefresh";
import { peekScreenCache, readScreenCache, writeScreenCache } from "../lib/screenCache";
import { formatDateInAppTimeZone } from "../utils/timezone";

type PaymentPlan = {
  code: string;
  name: string;
  amount: number;
  currency: "NPR";
  description: string;
};

type PaymentRecord = {
  id: string;
  amount: number;
  method: string;
  status: string;
  date: string;
  planName?: string | null;
  quantity?: number;
};

type PaymentsCacheEnvelope = {
  payments: PaymentRecord[];
  plans: PaymentPlan[];
  savedAt: number;
};

export default function PaymentsScreen() {
  const initialCached = peekScreenCache<PaymentsCacheEnvelope>("payments");
  const [payments, setPayments] = useState<PaymentRecord[]>(initialCached?.payments || []);
  const [plans, setPlans] = useState<PaymentPlan[]>(initialCached?.plans || []);
  const [loading, setLoading] = useState(!initialCached);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading((current) => current || (payments.length === 0 && plans.length === 0));
    try {
      const [paymentsRes, plansRes] = await Promise.all([api.get("/payments/me"), api.get("/payments/plans")]);
      setPayments(paymentsRes.data);
      setPlans(plansRes.data);
      await writeScreenCache<PaymentsCacheEnvelope>("payments", {
        payments: paymentsRes.data,
        plans: plansRes.data,
        savedAt: Date.now()
      });
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not load payment history.");
    } finally {
      setLoading(false);
    }
  }, [payments.length, plans.length]);

  const { seedLoadedAt } = useStaleFocusRefresh(
    useCallback(async () => {
      await load();
    }, [load]),
    5 * 60 * 1000
  );

  useEffect(() => {
    void (async () => {
      const cached = await readScreenCache<PaymentsCacheEnvelope>("payments");
      if (!cached) return;
      setPayments(cached.payments || []);
      setPlans(cached.plans || []);
      setLoading(false);
      if (cached.savedAt) {
        seedLoadedAt(cached.savedAt);
      }
    })();
  }, [seedLoadedAt]);

  return (
    <View style={styles.container}>
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Payments are managed by admin</Text>
        <Text style={styles.noticeText}>Review your payment history and the current gym pricing here.</Text>
      </View>

      <View style={styles.pricingCard}>
        <Text style={styles.pricingTitle}>Available payment options</Text>
        {plans.map((plan) => (
          <View key={plan.code} style={styles.planRow}>
            <Text style={styles.cardTitle}>{plan.name} • {plan.amount} NPR</Text>
            <Text style={styles.subText}>{plan.description}</Text>
          </View>
        ))}
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {(item.planName || "Payment")} • {item.amount} NPR
              </Text>
              <Text style={styles.subText}>Qty: {item.quantity || 1}</Text>
              <Text style={styles.subText}>{formatDateInAppTimeZone(item.date)}</Text>
              <Text style={styles.subText}>{item.method} • {item.status}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.subText}>No payments recorded yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1120",
    padding: 16
  },
  noticeCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  pricingCard: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  pricingTitle: {
    color: "#F8FAFC",
    fontWeight: "700",
    marginBottom: 8
  },
  planRow: {
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.18)"
  },
  noticeTitle: {
    color: "#F8FAFC",
    fontWeight: "700",
    marginBottom: 4
  },
  noticeText: {
    color: "#94A3B8"
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  cardTitle: {
    color: "#F8FAFC",
    fontWeight: "600"
  },
  subText: {
    color: "#94A3B8"
  },
  errorText: {
    color: "#F87171",
    marginBottom: 12
  }
});
