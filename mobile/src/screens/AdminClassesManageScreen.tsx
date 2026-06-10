import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  capacity: number;
  reservationCount?: number;
  checkedInCount?: number;
};

type AdminClassesCacheEnvelope = {
  classes: ClassItem[];
  savedAt: number;
};

type WorkoutItem = {
  id: string;
  date: string;
  description: string;
};

export default function AdminClassesManageScreen() {
  const insets = useSafeAreaInsets();
  const initialCached = peekScreenCache<ClassItem[] | AdminClassesCacheEnvelope>("admin-classes");
  const [classes, setClasses] = useState<ClassItem[]>(
    Array.isArray(initialCached) ? initialCached : initialCached?.classes || []
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string>("");
  const [expandedWorkout, setExpandedWorkout] = useState<WorkoutItem | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    setLoading((current) => current || classes.length === 0);
    setErrorMessage(null);
    try {
      const res = await api.get("/classes", { params: { mine: "true", summary: "true", limit: "20" } });
      const nextClasses = (res.data as ClassItem[]).filter((item) => item.status !== "CANCELED");
      setClasses(nextClasses);
      await writeScreenCache<AdminClassesCacheEnvelope>("admin-classes", {
        classes: nextClasses,
        savedAt: Date.now()
      });
    } finally {
      setLoading(false);
    }
  }, [classes.length]);

  const { refreshNow, seedLoadedAt } = useStaleFocusRefresh(
    useCallback(async () => {
      try {
        await loadClasses();
      } catch (err: any) {
        setErrorMessage(err?.response?.data?.message || "Could not load assigned classes.");
      }
    }, [loadClasses]),
    5 * 60 * 1000
  );

  useEffect(() => {
    void (async () => {
      const cached = await readScreenCache<ClassItem[] | AdminClassesCacheEnvelope>("admin-classes");
      if (!cached) return;

      if (Array.isArray(cached)) {
        if (cached.length) {
          setClasses(cached);
        }
        return;
      }

      if (cached.classes?.length) {
        setClasses(cached.classes);
      }
      if (cached.savedAt) {
        seedLoadedAt(cached.savedAt);
      }
    })();
  }, [seedLoadedAt]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshNow();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not refresh assigned classes.");
    } finally {
      setRefreshing(false);
    }
  }, [refreshNow]);

  const handleOpenClass = useCallback(async (classId: string) => {
    if (expandedClassId === classId) {
      setExpandedClassId("");
      setExpandedWorkout(null);
      setExpandedError(null);
      return;
    }

    setExpandedClassId(classId);
    setExpandedWorkout(null);
    setExpandedError(null);
    setExpandedLoading(true);
    try {
      const workoutRes = await api.get(`/classes/${classId}/workout`);
      setExpandedWorkout((workoutRes.data as WorkoutItem | null) ?? null);
    } catch (err: any) {
      setExpandedError(err?.response?.data?.message || "Could not load the workout for this class.");
    } finally {
      setExpandedLoading(false);
    }
  }, [expandedClassId]);

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <ScrollView
        style={[styles.container, { paddingTop: insets.top + 8 }]}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.textPrimary} />}
      >
        <Text style={styles.title}>Classes</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coaching Schedule</Text>

          {loading ? <ActivityIndicator color={theme.colors.textPrimary} style={styles.loader} /> : null}
          {!loading && classes.length === 0 ? <Text style={styles.subText}>No classes are assigned to you yet.</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          {classes.map((item) => {
            const signupCount = item.reservationCount || 0;
            const checkedInCount = item.checkedInCount || 0;

            return (
              <TouchableOpacity key={item.id} style={styles.classRow} onPress={() => void handleOpenClass(item.id)} activeOpacity={0.85}>
                <Text style={styles.classTitle}>{item.title}</Text>
                <Text style={styles.subText}>{formatDateTimeInAppTimeZone(item.datetime)}</Text>
                <Text style={styles.subText}>Status: {item.status}</Text>
                <Text style={styles.subText}>Reservations: {signupCount}/{item.capacity}</Text>
                <Text style={styles.subText}>Checked In: {checkedInCount}</Text>
                {expandedClassId === item.id ? (
                  <View style={styles.expandedCard}>
                    <Text style={styles.expandedTitle}>Workout Of The Day</Text>
                    {expandedLoading ? <ActivityIndicator color={theme.colors.textPrimary} style={styles.loader} /> : null}
                    {!expandedLoading && expandedError ? <Text style={styles.errorText}>{expandedError}</Text> : null}
                    {!expandedLoading && !expandedError && expandedWorkout ? (
                      <>
                        <Text style={styles.subText}>{formatDateTimeInAppTimeZone(expandedWorkout.date)}</Text>
                        <Text style={styles.wodText}>{expandedWorkout.description}</Text>
                      </>
                    ) : null}
                    {!expandedLoading && !expandedError && !expandedWorkout ? (
                      <Text style={styles.subText}>No workout has been added for this class yet.</Text>
                    ) : null}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
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
  classRow: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 10
  },
  classTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  expandedCard: {
    marginTop: 10,
    paddingTop: 10,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1
  },
  expandedTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4
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
    marginTop: 8
  },
  errorText: {
    color: theme.colors.danger,
    marginTop: 8
  }
});
