import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import TabWallpaper from "../components/TabWallpaper";
import { theme, shadow } from "../theme";
import { formatDateTimeInAppTimeZone } from "../utils/timezone";

export default function AdminAnnouncementsManageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", body: "", imageUrl: "" });
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.get("/announcements");
    setList(res.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().catch(() => undefined);
    }, [load])
  );

  const postAnnouncement = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    if (!form.title.trim() || !form.body.trim()) {
      setErrorMessage("Title and body are required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        body: form.body.trim()
      };
      if (form.imageUrl.trim()) {
        payload.imageUrl = form.imageUrl.trim();
      }

      await api.post("/announcements", payload);
      setForm({ title: "", body: "", imageUrl: "" });
      setStatusMessage("Announcement posted.");
      await load();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not post announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAnnouncement = async (announcementId: string) => {
    setStatusMessage(null);
    setErrorMessage(null);

    Alert.alert("Delete Announcement", "Remove this announcement?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await api.delete(`/announcements/${announcementId}`);
              setStatusMessage("Announcement deleted.");
              await load();
            } catch (err: any) {
              setErrorMessage(err?.response?.data?.message || "Could not delete announcement.");
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

        <Text style={styles.title}>Announcements Manager</Text>
        <Text style={styles.subtitle}>Create and review announcements.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Announcement</Text>
          <TextInput
            style={styles.input}
            placeholder="Title"
            placeholderTextColor={theme.colors.textSecondary}
            value={form.title}
            onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Body"
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            value={form.body}
            onChangeText={(value) => setForm((prev) => ({ ...prev, body: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Image URL (optional)"
            placeholderTextColor={theme.colors.textSecondary}
            value={form.imageUrl}
            onChangeText={(value) => setForm((prev) => ({ ...prev, imageUrl: value }))}
          />
          <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={() => void postAnnouncement()} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? "Posting..." : "Post"}</Text>
          </TouchableOpacity>
          {statusMessage ? <Text style={styles.successText}>{statusMessage}</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent</Text>
          {list.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.subText}>{item.body}</Text>
              <Text style={styles.subText}>{formatDateTimeInAppTimeZone(item.createdAt)}</Text>
              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteAnnouncement(item.id)}>
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
  itemTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  subText: {
    color: theme.colors.textSecondary,
    marginTop: 2
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
