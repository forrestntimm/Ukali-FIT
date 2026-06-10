import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import TabWallpaper from "../components/TabWallpaper";
import { useStaleFocusRefresh } from "../hooks/useStaleFocusRefresh";
import { readScreenCache, writeScreenCache } from "../lib/screenCache";
import { theme, shadow } from "../theme";
import { formatDateInAppTimeZone } from "../utils/timezone";

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const cached = await readScreenCache<any[]>("announcements");
      if (cached?.length) {
        setAnnouncements(cached);
      }
    })();
  }, []);

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await api.get("/announcements");
      setAnnouncements(res.data);
      await writeScreenCache("announcements", res.data);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not load announcements.");
    }
  }, []);

  const { refreshNow } = useStaleFocusRefresh(loadAnnouncements, 30000);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNow();
    setRefreshing(false);
  }, [refreshNow]);

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.heading}>Announcements</Text>
        <Text style={styles.subtitle}>Announcements from coaches and staff.</Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.textPrimary} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No announcements yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : null}
              <Text style={styles.date}>{formatDateInAppTimeZone(item.createdAt)}</Text>
            </View>
          )}
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
  heading: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginBottom: 12
  },
  errorText: {
    color: theme.colors.danger,
    marginBottom: 10
  },
  emptyText: {
    color: theme.colors.textSecondary,
    marginTop: 8
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
  title: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4
  },
  body: {
    color: theme.colors.textSecondary
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginTop: 8
  },
  date: {
    color: theme.colors.textSecondary,
    marginTop: 8,
    fontSize: 12
  }
});
