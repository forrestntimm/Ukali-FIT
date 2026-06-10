import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import TabWallpaper from "../components/TabWallpaper";
import { theme, shadow } from "../theme";
import { formatDateInAppTimeZone, toDayKeyInAppTimeZone } from "../utils/timezone";

export default function AdminWodManageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [dateInput, setDateInput] = useState(() => toDayKeyInAppTimeZone(new Date()));
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.get("/workouts");
    setWorkouts(res.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().catch(() => undefined);
    }, [load])
  );

  const saveWorkout = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    if (!dateInput.trim() || !description.trim()) {
      setErrorMessage("Date and description are required.");
      return;
    }

    const normalizedDate = dateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      setErrorMessage("Date must be valid. Example: 2026-03-15");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/workouts", {
        date: normalizedDate,
        description: description.trim()
      });
      setDateInput(toDayKeyInAppTimeZone(new Date()));
      setDescription("");
      setStatusMessage("Workout saved.");
      await load();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not save workout.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeWorkout = async (id: string) => {
    Alert.alert("Delete Workout", "Remove this workout entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await api.delete(`/workouts/${id}`);
              await load();
            } catch (err: any) {
              setErrorMessage(err?.response?.data?.message || "Could not delete workout.");
            }
          })();
        }
      }
    ]);
  };

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <ScrollView style={[styles.container, { paddingTop: insets.top + 8 }]} contentContainerStyle={styles.contentContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Workout Manager</Text>
        <Text style={styles.subtitle}>Create and maintain workout programming.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Save WOD</Text>
          <TextInput
            style={styles.input}
            placeholder="Date (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.textSecondary}
            value={dateInput}
            onChangeText={setDateInput}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Workout description"
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            value={description}
            onChangeText={setDescription}
          />
          <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={() => void saveWorkout()} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>
          {statusMessage ? <Text style={styles.successText}>{statusMessage}</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Saved Workouts</Text>
          {workouts.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemTitle}>{formatDateInAppTimeZone(item.date)}</Text>
              <Text style={styles.subText}>{item.description}</Text>
              <TouchableOpacity style={styles.deleteButton} onPress={() => removeWorkout(item.id)}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
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
  textArea: {
    minHeight: 92,
    textAlignVertical: "top"
  },
  button: {
    backgroundColor: theme.colors.adminAccentMutedTranslucent,
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11
  },
  buttonDisabled: {
    opacity: 0.55
  },
  buttonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
  },
  itemRow: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 10
  },
  itemTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  subText: {
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  deleteButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "rgba(142, 29, 34, 0.7)",
    borderColor: theme.colors.danger,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  deleteButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
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
