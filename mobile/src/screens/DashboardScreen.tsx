import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import TabWallpaper from "../components/TabWallpaper";
import { theme, shadow } from "../theme";

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [wod, setWod] = useState<any>(null);

  const loadWod = useCallback(async () => {
    try {
      const res = await api.get("/workouts/today");
      setWod(res.data);
    } catch {
      setWod(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshUser().catch(() => undefined);
      void loadWod();
    }, [refreshUser, loadWod])
  );

  const nextDue = user?.nextPaymentDue ? new Date(user.nextPaymentDue) : null;
  const daysRemaining = nextDue ? Math.ceil((nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const overdue = daysRemaining !== null && daysRemaining < 0;
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Member";
  const isPaid = user?.paymentStatus === "PAID";
  const hasWod = Boolean(wod?.description);
  const qrValue = user?.checkInQrCode || "";
  const qrImageUrl = qrValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(qrValue)}`
    : null;

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <ScrollView style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.heading}>Dashboard</Text>
        <Text style={styles.subtitle}>Welcome back {firstName}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Streak</Text>
            <Text style={styles.metricValue}>{user?.workoutStreak ?? 0}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Classes</Text>
            <Text style={styles.metricValue}>{user?.classesTotalAttended ?? 0}</Text>
          </View>
        </View>

        <View style={[styles.card, !isPaid && styles.paymentCard, !isPaid && overdue && styles.cardOverdue]}>
          <Text style={styles.cardTitle}>Payment Status</Text>
          <Text style={styles.statusText}>{overdue ? "Overdue" : user?.paymentStatus || "UNPAID"}</Text>
          {daysRemaining !== null ? (
            <Text style={styles.subText}>{Math.abs(daysRemaining)} day(s) {overdue ? "overdue" : "remaining"}</Text>
          ) : (
            <Text style={styles.subText}>No due date set</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Workout of the Day</Text>
          <Text style={[styles.wodText, hasWod ? styles.wodTextFilled : styles.wodTextEmpty]}>
            {wod?.description || "No workout posted yet."}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>QR Check-in Code</Text>
          {qrImageUrl ? (
            <>
              <View style={styles.qrBlock}>
                <Image source={{ uri: qrImageUrl }} style={styles.qrImage} />
              </View>
              <Text style={styles.subText}>Show this block to admin for check-in scanning.</Text>
              <Text selectable style={styles.qrText}>{qrValue}</Text>
            </>
          ) : (
            <Text style={styles.subText}>Not available</Text>
          )}
        </View>
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
    padding: 16
  },
  heading: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: "700"
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginTop: 6,
    marginBottom: 14
  },
  metricsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    ...shadow
  },
  metricLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  metricValue: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 6
  },
  card: {
    backgroundColor: theme.colors.surfaceTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 16,
    ...shadow
  },
  cardOverdue: {
    borderWidth: 1,
    borderColor: theme.colors.danger
  },
  paymentCard: {
    backgroundColor: "rgba(142, 29, 34, 0.7)"
  },
  cardTitle: {
    color: theme.colors.textSecondary,
    marginBottom: 8
  },
  statusText: {
    fontSize: 22,
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  subText: {
    color: theme.colors.textSecondary,
    marginTop: 4
  },
  wodText: {
    marginTop: 2
  },
  wodTextFilled: {
    color: theme.colors.textSecondary,
    textAlign: "center",
    fontSize: 17,
    lineHeight: 38,
    fontWeight: "500"
  },
  wodTextEmpty: {
    color: theme.colors.textPrimary,
    fontSize: 16
  },
  qrBlock: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    alignSelf: "flex-start"
  },
  qrImage: {
    width: 200,
    height: 200
  },
  qrText: {
    color: theme.colors.textPrimary,
    fontFamily: "Courier",
    marginTop: 6
  }
});
