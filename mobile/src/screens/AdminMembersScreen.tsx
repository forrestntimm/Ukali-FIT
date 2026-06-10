import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import TabWallpaper from "../components/TabWallpaper";
import { useStaleFocusRefresh } from "../hooks/useStaleFocusRefresh";
import { peekScreenCache, readScreenCache, writeScreenCache } from "../lib/screenCache";
import { theme, shadow } from "../theme";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  paymentStatus?: "PAID" | "UNPAID";
};

type AdminMembersCacheEnvelope = {
  members: Member[];
  savedAt: number;
};

export default function AdminMembersScreen() {
  const insets = useSafeAreaInsets();
  const initialCached = peekScreenCache<Member[] | AdminMembersCacheEnvelope>("admin-members");
  const [members, setMembers] = useState<Member[]>(
    Array.isArray(initialCached) ? initialCached : initialCached?.members || []
  );
  const [loading, setLoading] = useState(!initialCached);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading((current) => current || members.length === 0);
    setError(null);
    try {
      const res = await api.get("/users/member-options");
      const nextMembers = (res.data as Member[]).filter((member) => member.role === "MEMBER");
      setMembers(nextMembers);
      await writeScreenCache<AdminMembersCacheEnvelope>("admin-members", {
        members: nextMembers,
        savedAt: Date.now()
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load members.");
    } finally {
      setLoading(false);
    }
  }, [members.length]);

  const { seedLoadedAt } = useStaleFocusRefresh(load, 30000);

  useEffect(() => {
    void (async () => {
      const cached = await readScreenCache<Member[] | AdminMembersCacheEnvelope>("admin-members");
      if (!cached) return;

      if (Array.isArray(cached)) {
        if (cached.length) {
          setMembers(cached);
        }
        return;
      }

      if (cached.members?.length) {
        setMembers(cached.members);
      }
      if (cached.savedAt) {
        seedLoadedAt(cached.savedAt);
      }
    })();
  }, [seedLoadedAt]);

  const paidMembers = members.filter((member) => member.paymentStatus === "PAID");
  const unpaidMembers = members.filter((member) => member.paymentStatus !== "PAID");

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <ScrollView style={[styles.container, { paddingTop: insets.top + 8 }]} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Members</Text>
        <Text style={styles.subtitle}>Payment status list for paid and unpaid athletes.</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Paid</Text>
            <Text style={styles.metricValue}>{paidMembers.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Unpaid</Text>
            <Text style={styles.metricValue}>{unpaidMembers.length}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paid Members</Text>
          {paidMembers.length === 0 ? <Text style={styles.subText}>No paid members listed.</Text> : null}
          {paidMembers.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.subText}>{member.email}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Unpaid Members</Text>
          {unpaidMembers.length === 0 ? <Text style={styles.subText}>No unpaid members listed.</Text> : null}
          {unpaidMembers.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.subText}>{member.email}</Text>
            </View>
          ))}
        </View>

        {loading ? <ActivityIndicator color={theme.colors.textPrimary} style={styles.loader} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.adminSurfaceTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: 12,
    ...shadow
  },
  metricLabel: {
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 12
  },
  metricValue: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 6
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
  memberRow: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 10
  },
  memberName: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  subText: {
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  loader: {
    marginTop: 6
  },
  errorText: {
    color: theme.colors.danger,
    marginTop: 8
  }
});
