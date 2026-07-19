import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import TabWallpaper from "../components/TabWallpaper";
import { useStaleFocusRefresh } from "../hooks/useStaleFocusRefresh";
import { peekScreenCache, readScreenCache, writeScreenCache } from "../lib/screenCache";
import { theme, shadow } from "../theme";
import { formatDateTimeInAppTimeZone } from "../utils/timezone";

type ClassItem = {
  id: string;
  title: string;
  datetime: string;
  status: "OPEN" | "CLOSED" | "CANCELED";
  coachAssignmentRole?: "PRIMARY" | "SECONDARY";
  capacity: number;
  reservationCount?: number;
  checkedInCount?: number;
};

type ClassSignup = {
  id: string;
  checkedInAt?: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    paymentStatus?: "PAID" | "UNPAID";
  };
};

type WorkoutItem = {
  id: string;
  date: string;
  description: string;
};

type AdminDashboardCacheEnvelope = {
  classes: ClassItem[];
  gymSchedule: ClassItem[];
  selectedClassId: string;
  signups: ClassSignup[];
  wod: WorkoutItem | null;
  savedAt: number;
};

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const initialCached = peekScreenCache<AdminDashboardCacheEnvelope>("admin-dashboard");
  const [classes, setClasses] = useState<ClassItem[]>(initialCached?.classes || []);
  const [gymSchedule, setGymSchedule] = useState<ClassItem[]>(initialCached?.gymSchedule || []);
  const [selectedClassId, setSelectedClassId] = useState<string>(initialCached?.selectedClassId || "");
  const [signups, setSignups] = useState<ClassSignup[]>(initialCached?.signups || []);
  const [wod, setWod] = useState<WorkoutItem | null>(initialCached?.wod || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gymScheduleExpanded, setGymScheduleExpanded] = useState(false);

  const loadClassDetails = useCallback(async (classId: string) => {
    const signupResult = await Promise.allSettled([
      api.get(`/classes/${classId}/signups`)
    ]);

    const nextSignups =
      signupResult[0].status === "fulfilled" ? (signupResult[0].value.data as ClassSignup[]) : [];

    return {
      signups: nextSignups,
      hasDetailFailure: signupResult[0].status === "rejected"
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading((current) => current || classes.length === 0);
    setError(null);
    try {
      const [classRes, workoutRes] = await Promise.all([
        api.get("/classes", { params: { mine: "true", summary: "true", limit: "20" } }),
        api.get("/workouts/today")
      ]);
      const upcomingClasses = (classRes.data as ClassItem[]).filter((klass) => klass.status !== "CANCELED");
      const nextWod = ((workoutRes.data as WorkoutItem | null) ?? null);
      setClasses(upcomingClasses);
      setWod(nextWod);

      const defaultClassId =
        selectedClassId && upcomingClasses.find((klass) => klass.id === selectedClassId)
          ? selectedClassId
          : upcomingClasses[0]?.id || "";
      setSelectedClassId(defaultClassId);

      if (!defaultClassId) {
        setSignups([]);
        const gymScheduleResult = await Promise.allSettled([
          api.get("/classes", { params: { summary: "true", limit: "5" } })
        ]);
        const nextGymSchedule =
          gymScheduleResult[0].status === "fulfilled"
            ? ((gymScheduleResult[0].value.data as ClassItem[]) ?? []).filter((klass) => klass.status !== "CANCELED")
            : [];
        setGymSchedule(nextGymSchedule);
        await writeScreenCache<AdminDashboardCacheEnvelope>("admin-dashboard", {
          classes: upcomingClasses,
          gymSchedule: nextGymSchedule,
          selectedClassId: "",
          signups: [],
          wod: nextWod,
          savedAt: Date.now()
        });
        return;
      }

      const detailResult = await loadClassDetails(defaultClassId);
      setGymSchedule([]);
      setSignups(detailResult.signups);
      await writeScreenCache<AdminDashboardCacheEnvelope>("admin-dashboard", {
        classes: upcomingClasses,
        gymSchedule: [],
        selectedClassId: defaultClassId,
        signups: detailResult.signups,
        wod: nextWod,
        savedAt: Date.now()
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [classes.length, loadClassDetails, selectedClassId]);

  const { seedLoadedAt } = useStaleFocusRefresh(loadDashboard, 5 * 60 * 1000);

  useEffect(() => {
    void (async () => {
      const cached = await readScreenCache<AdminDashboardCacheEnvelope>("admin-dashboard");
      if (!cached) return;
      setClasses(cached.classes || []);
      setGymSchedule(cached.gymSchedule || []);
      setSelectedClassId(cached.selectedClassId || "");
      setSignups(cached.signups || []);
      setWod(cached.wod || null);
      if (cached.savedAt) {
        seedLoadedAt(cached.savedAt);
      }
    })();
  }, [seedLoadedAt]);

  const selectedClass = useMemo(
    () => classes.find((klass) => klass.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const loadForClass = useCallback(async (classId: string) => {
    setSelectedClassId(classId);
    setLoading((current) => current || signups.length === 0);
    setError(null);
    try {
      const detailResult = await loadClassDetails(classId);
      setGymSchedule([]);
      setSignups(detailResult.signups);
      await writeScreenCache<AdminDashboardCacheEnvelope>("admin-dashboard", {
        classes,
        gymSchedule: [],
        selectedClassId: classId,
        signups: detailResult.signups,
        wod,
        savedAt: Date.now()
      });
      if (detailResult.hasDetailFailure) {
        setError("Some class details could not be loaded.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load class details.");
    } finally {
      setLoading(false);
    }
  }, [classes, loadClassDetails, signups.length, wod]);

  const paidCount = signups.filter((signup) => signup.user?.paymentStatus === "PAID").length;
  const unpaidCount = signups.length - paidCount;

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <ScrollView style={[styles.container, { paddingTop: insets.top + 8 }]} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.heading}>Admin Dashboard</Text>
        <Text style={styles.subtitle}>Class attendance, payment status, and workout of the day.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Coaching Schedule</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {classes.map((klass) => {
              const active = klass.id === selectedClassId;
              return (
                <TouchableOpacity
                  key={klass.id}
                  style={[styles.classChip, active && styles.classChipActive]}
                  onPress={() => void loadForClass(klass.id)}
                >
                  <Text style={styles.classChipTitle}>{klass.title}</Text>
                  <Text style={styles.classChipSub}>
                    {klass.coachAssignmentRole === "SECONDARY" ? "Secondary Coach" : "Primary Coach"}
                  </Text>
                  <Text style={styles.classChipSub}>{formatDateTimeInAppTimeZone(klass.datetime)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {!selectedClass ? <Text style={styles.subText}>No class selected.</Text> : null}
        </View>

        {classes.length === 0 ? (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.gymScheduleHeader}
              onPress={() => setGymScheduleExpanded((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={`${gymScheduleExpanded ? "Collapse" : "Expand"} gym schedule`}
              activeOpacity={0.85}
            >
              <View>
                <Text style={styles.cardTitle}>Gym Schedule</Text>
                <Text style={styles.subText}>Upcoming open classes at the gym.</Text>
              </View>
              <Text style={styles.gymScheduleToggle}>{gymScheduleExpanded ? "Collapse" : "Expand"}</Text>
            </TouchableOpacity>
            {gymScheduleExpanded && gymSchedule.length === 0 ? (
              <Text style={styles.subText}>No upcoming open classes are available right now.</Text>
            ) : null}
            {gymScheduleExpanded ? gymSchedule.map((klass) => (
              <View key={klass.id} style={styles.gymScheduleRow}>
                <Text style={styles.classChipTitle}>{klass.title}</Text>
                <Text style={styles.subText}>{formatDateTimeInAppTimeZone(klass.datetime)}</Text>
              </View>
            )) : null}
          </View>
        ) : null}

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Coming</Text>
            <Text style={styles.metricValue}>{signups.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Paid</Text>
            <Text style={styles.metricValue}>{paidCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Unpaid</Text>
            <Text style={styles.metricValue}>{unpaidCount}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Workout Of The Day</Text>
          {wod ? (
            <>
              <Text style={styles.subText}>{formatDateTimeInAppTimeZone(wod.date)}</Text>
              <Text style={styles.wodText}>{wod.description}</Text>
            </>
          ) : (
            <Text style={styles.subText}>No workout has been added for today.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Members Coming To This Class</Text>
          {signups.length === 0 ? <Text style={styles.subText}>No reservations for this class yet.</Text> : null}
          {signups.map((signup) => (
            <View key={signup.id} style={styles.memberRow}>
              <Text style={styles.memberName}>{signup.user?.name || "Unknown Member"}</Text>
              <Text style={styles.memberPaid}>Paid: {signup.user?.paymentStatus === "PAID" ? "Yes" : "No"}</Text>
            </View>
          ))}
        </View>

        {loading ? <ActivityIndicator color={theme.colors.textPrimary} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
    marginBottom: 10
  },
  classChip: {
    width: 220,
    marginRight: 8,
    backgroundColor: theme.colors.adminSurfaceElevatedTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10
  },
  classChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.adminAccentMutedTranslucent
  },
  classChipTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  classChipSub: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2
  },
  gymScheduleRow: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 10
  },
  gymScheduleHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  gymScheduleToggle: {
    color: theme.colors.accent,
    fontWeight: "700"
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
    borderRadius: theme.radius.md,
    padding: 12,
    ...shadow
  },
  metricLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  metricValue: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 6
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
  memberPaid: {
    color: theme.colors.textSecondary,
    marginTop: 4
  },
  subText: {
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  wodText: {
    color: theme.colors.textPrimary,
    marginTop: 8,
    lineHeight: 20
  },
  loader: {
    marginTop: 2
  },
  error: {
    color: theme.colors.danger,
    marginTop: 8
  }
});
