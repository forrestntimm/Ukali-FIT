import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import TabWallpaper from "../components/TabWallpaper";
import { useAuth } from "../context/AuthContext";
import { useStaleFocusRefresh } from "../hooks/useStaleFocusRefresh";
import { peekScreenCache, readScreenCache, writeScreenCache } from "../lib/screenCache";
import { theme, shadow } from "../theme";
import { formatDateTimeInAppTimeZone } from "../utils/timezone";

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
  amount: number;
  method: string;
  status: string;
  date: string;
  planName?: string | null;
  quantity?: number;
};

type AdminPaymentsCacheEnvelope = {
  members: MemberOption[];
  plans: PaymentPlan[];
  savedAt: number;
};

export default function AdminPaymentsManageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, loading: authLoading } = useAuth();
  const initialCached = peekScreenCache<AdminPaymentsCacheEnvelope>("admin-payments");
  const [members, setMembers] = useState<MemberOption[]>(initialCached?.members || []);
  const [plans, setPlans] = useState<PaymentPlan[]>(initialCached?.plans || []);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedUserId),
    [members, selectedUserId]
  );
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === planCode) || null,
    [plans, planCode]
  );
  const normalizedQuantity = selectedPlan?.quantityEnabled ? Math.max(1, Number(quantity) || 1) : 1;
  const totalAmount = selectedPlan ? selectedPlan.amount * normalizedQuantity : 0;

  const loadPayments = useCallback(async (userId: string) => {
    if (!userId) {
      setPayments([]);
      return;
    }

    try {
      const res = await api.get(`/users/${userId}/payments`);
      setPayments(res.data);
    } catch {
      setPayments([]);
    }
  }, []);

  const loadPaymentOptions = useCallback(async () => {
    if (authLoading || user?.role !== "ADMIN") return;

    const [usersResult, plansResult] = await Promise.allSettled([
      api.get("/users/member-options"),
      api.get("/payments/plans")
    ]);

    let nextMembers = members;
    let nextPlans = plans;
    let nextError: string | null = null;

    if (usersResult.status === "fulfilled") {
      nextMembers = (usersResult.value.data as MemberOption[])
        .filter((member) => member.role === "MEMBER")
        .sort((a, b) => a.name.localeCompare(b.name));
      setMembers(nextMembers);
    } else {
      nextError = usersResult.reason?.response?.data?.message || "Could not load athletes.";
    }

    if (plansResult.status === "fulfilled") {
      nextPlans = plansResult.value.data as PaymentPlan[];
      setPlans(nextPlans);
      setPlanCode((current) => current || nextPlans[0]?.code || "");
    } else {
      nextError = plansResult.reason?.response?.data?.message || "Could not load payment options.";
    }

    if (usersResult.status === "fulfilled" || plansResult.status === "fulfilled") {
      await writeScreenCache<AdminPaymentsCacheEnvelope>("admin-payments", {
        members: nextMembers,
        plans: nextPlans,
        savedAt: Date.now()
      });
    }

    if (selectedUserId) {
      await loadPayments(selectedUserId);
    }
    setErrorMessage(nextError);
  }, [authLoading, loadPayments, members, plans, selectedUserId, user?.role]);

  const { seedLoadedAt } = useStaleFocusRefresh(loadPaymentOptions, 5 * 60 * 1000);

  React.useEffect(() => {
    void (async () => {
      const cached = await readScreenCache<AdminPaymentsCacheEnvelope>("admin-payments");
      if (!cached) return;
      if (cached.members?.length) {
        setMembers(cached.members);
      }
      if (cached.plans?.length) {
        setPlans(cached.plans);
        setPlanCode((current) => current || cached.plans[0]?.code || "");
      }
      if (cached.savedAt) {
        seedLoadedAt(cached.savedAt);
      }
    })();
  }, [seedLoadedAt]);

  const selectMember = (userId: string) => {
    setSelectedUserId(userId);
    setStatusMessage(null);
    setErrorMessage(null);
    void loadPayments(userId);
  };

  const recordPayment = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    if (!selectedUserId) {
      setErrorMessage("Select an athlete first.");
      return;
    }

    if (!selectedPlan) {
      setErrorMessage("Select a payment option first.");
      return;
    }

    if (selectedPlan.quantityEnabled && (!Number.isFinite(normalizedQuantity) || normalizedQuantity < 1)) {
      setErrorMessage("Quantity must be at least 1.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/payments/manual", {
        userId: selectedUserId,
        planCode: selectedPlan.code,
        quantity: selectedPlan.quantityEnabled ? normalizedQuantity : 1
      });
      const [usersRes, paymentsRes] = await Promise.all([
        api.get("/users/member-options"),
        api.get(`/users/${selectedUserId}/payments`)
      ]);
      const athleteMembers = (usersRes.data as MemberOption[])
        .filter((member) => member.role === "MEMBER")
        .sort((a, b) => a.name.localeCompare(b.name));
      setMembers(athleteMembers);
      setPayments(paymentsRes.data);
      await writeScreenCache<AdminPaymentsCacheEnvelope>("admin-payments", {
        members: athleteMembers,
        plans,
        savedAt: Date.now()
      });
      setStatusMessage(`Payment recorded for ${selectedMember?.name || "athlete"}.`);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <ScrollView style={[styles.container, { paddingTop: insets.top + 8 }]} contentContainerStyle={styles.contentContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Payments Manager</Text>
        <Text style={styles.subtitle}>Record preset gym payments and review payment history.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Athlete</Text>
          {authLoading ? <Text style={styles.subText}>Restoring your admin session...</Text> : null}
          {members.map((member) => {
            const isSelected = selectedUserId === member.id;
            return (
              <TouchableOpacity
                key={member.id}
                style={[styles.memberChip, isSelected && styles.memberChipActive]}
                onPress={() => selectMember(member.id)}
              >
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.subText}>Status: {member.paymentStatus}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Payment Option</Text>
          {plans.map((plan) => {
            const isSelected = planCode === plan.code;
            return (
              <TouchableOpacity
                key={plan.code}
                style={[styles.planChip, isSelected && styles.planChipActive]}
                onPress={() => {
                  setPlanCode(plan.code);
                  setQuantity("1");
                }}
              >
                <Text style={styles.memberName}>{plan.name} • {plan.amount} {plan.currency}</Text>
                <Text style={styles.subText}>{plan.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Record Cash Payment</Text>
          {selectedPlan?.quantityEnabled ? (
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="Quantity"
              placeholderTextColor={theme.colors.textSecondary}
              value={quantity}
              onChangeText={setQuantity}
            />
          ) : null}
          {selectedPlan ? (
            <Text style={styles.subText}>
              Selected plan: {selectedPlan.name} • Total: {totalAmount} NPR
            </Text>
          ) : null}
          {selectedMember ? <Text style={styles.subText}>Current status: {selectedMember.paymentStatus}</Text> : null}
          <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={() => void recordPayment()} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? "Saving..." : "Mark Paid"}</Text>
          </TouchableOpacity>
          {statusMessage ? <Text style={styles.successText}>{statusMessage}</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        {selectedMember ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Payments - {selectedMember.name}</Text>
            {payments.length === 0 ? <Text style={styles.subText}>No payments recorded yet.</Text> : null}
            {payments.map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <Text style={styles.memberName}>
                  {payment.planName || "Custom Payment"} • {payment.amount} NPR
                </Text>
                <Text style={styles.subText}>Qty: {payment.quantity || 1}</Text>
                <Text style={styles.subText}>{formatDateTimeInAppTimeZone(payment.date)}</Text>
                <Text style={styles.subText}>Status: {payment.status}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 16
  },
  contentContainer: {
    paddingBottom: 120
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.adminSurfaceElevatedTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10
  },
  backButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginBottom: 12
  },
  card: {
    backgroundColor: theme.colors.adminSurfaceTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 12,
    ...shadow
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginBottom: 8
  },
  memberChip: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 8,
    backgroundColor: theme.colors.adminSurfaceElevatedTranslucent
  },
  memberChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.adminAccentMutedTranslucent
  },
  planChip: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 8,
    backgroundColor: theme.colors.adminSurfaceElevatedTranslucent
  },
  planChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.adminAccentMutedTranslucent
  },
  memberName: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  input: {
    backgroundColor: theme.colors.adminSurfaceElevatedTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10
  },
  button: {
    backgroundColor: theme.colors.adminAccentMutedTranslucent,
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11,
    marginTop: 4
  },
  buttonDisabled: {
    opacity: 0.55
  },
  buttonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
  },
  subText: {
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  paymentRow: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 10
  },
  successText: {
    color: theme.colors.success,
    marginTop: 8
  },
  errorText: {
    color: theme.colors.danger,
    marginTop: 8
  }
});
