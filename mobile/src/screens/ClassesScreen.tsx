import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import TabWallpaper from "../components/TabWallpaper";
import { theme, shadow } from "../theme";
import { formatDateTimeInAppTimeZone, formatDayLabelInAppTimeZone, toDayKeyInAppTimeZone } from "../utils/timezone";
import { useAuth } from "../context/AuthContext";

export default function ClassesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [bookingClassId, setBookingClassId] = useState<string | null>(null);

  const load = () => {
    api.get("/classes").then((res) => setClasses(res.data));
  };

  useEffect(() => {
    load();
  }, []);

  const classesByDay = classes.reduce<Record<string, any[]>>((acc, klass) => {
    const key = toDayKeyInAppTimeZone(klass.datetime);
    if (!acc[key]) acc[key] = [];
    acc[key].push(klass);
    return acc;
  }, {});
  const dayKeys = Object.keys(classesByDay).sort();

  useEffect(() => {
    if (!dayKeys.length) {
      setSelectedDay("");
      return;
    }
    if (!selectedDay || !classesByDay[selectedDay]) {
      setSelectedDay(dayKeys[0]);
    }
  }, [dayKeys.join(","), selectedDay]);

  const signup = async (id: string) => {
    setBookingClassId(id);
    try {
      await api.post(`/classes/${id}/signup`);
      Alert.alert("Class Reserved", "Your reservation was saved and is now visible to coaches in admin.");
      load();
    } catch (err: any) {
      Alert.alert(
        "Unable to sign up",
        err?.response?.data?.message || "This class could not be booked. Please try another class."
      );
    } finally {
      setBookingClassId(null);
    }
  };

  const confirmSignup = (klass: any) => {
    const formatted = formatDateTimeInAppTimeZone(klass.datetime);
    Alert.alert(
      "Confirm Class Selection",
      `${klass.title}\n${formatted}\n\nReserve this class?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => signup(klass.id) }
      ]
    );
  };

  const classesForDay = selectedDay ? classesByDay[selectedDay] || [] : [];

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Class Schedule</Text>
        <Text style={styles.subtitle}>Choose a day and reserve your spot.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayMenu}>
          {dayKeys.map((key) => {
            const active = key === selectedDay;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() => setSelectedDay(key)}
              >
                <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{formatDayLabelInAppTimeZone(key)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <FlatList
          data={classesForDay}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>No classes available for this day.</Text>}
          renderItem={({ item }) => {
            const remaining = item.capacity - (item.signups?.length || 0);
            const alreadySignedUp = Boolean(item.signups?.some((signup: any) => signup.userId === user?.id));
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.subText}>{formatDateTimeInAppTimeZone(item.datetime)}</Text>
                <Text style={styles.subText}>{remaining} spots left</Text>
                <TouchableOpacity
                  style={[
                    styles.button,
                    (item.status !== "OPEN" || remaining <= 0 || alreadySignedUp || bookingClassId === item.id) && styles.buttonDisabled
                  ]}
                  onPress={() => confirmSignup(item)}
                  disabled={item.status !== "OPEN" || remaining <= 0 || alreadySignedUp || bookingClassId === item.id}
                >
                  <Text style={styles.buttonText}>
                    {alreadySignedUp ? "Reserved" : item.status !== "OPEN" ? "Closed" : remaining <= 0 ? "Full" : bookingClassId === item.id ? "Reserving..." : "Sign Up"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>
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
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginBottom: 10
  },
  dayMenu: {
    marginBottom: 12,
    maxHeight: 44
  },
  dayChip: {
    backgroundColor: theme.colors.surfaceTranslucent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  dayChipActive: {
    backgroundColor: theme.colors.accentMutedTranslucent,
    borderColor: theme.colors.accent
  },
  dayChipText: {
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  dayChipTextActive: {
    color: theme.colors.textPrimary
  },
  card: {
    backgroundColor: theme.colors.surfaceTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 12,
    ...shadow
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 16
  },
  subText: {
    color: theme.colors.textSecondary
  },
  button: {
    marginTop: 8,
    backgroundColor: theme.colors.accentMutedTranslucent,
    borderColor: theme.colors.accent,
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.55
  },
  buttonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
  },
  emptyText: {
    color: theme.colors.textSecondary,
    marginTop: 16
  }
});
