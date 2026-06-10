import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { APP_DISPLAY_NAME } from "../config/appVariant";
import TabWallpaper from "./TabWallpaper";
import { theme } from "../theme";

export default function AppLoadingScreen({
  title = APP_DISPLAY_NAME,
  subtitle = "Loading your account..."
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <ActivityIndicator color={theme.colors.textPrimary} style={styles.spinner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl
  },
  content: {
    alignItems: "center"
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    fontWeight: "700"
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontSize: 15
  },
  spinner: {
    marginTop: theme.spacing.lg
  }
});
