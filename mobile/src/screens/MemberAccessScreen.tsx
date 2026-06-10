import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import TabWallpaper from "../components/TabWallpaper";
import { ADMIN_WEB_APP_URL } from "../config/appVariant";
import { theme } from "../theme";

export default function MemberAccessScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const openAdminWeb = async () => {
    await Linking.openURL(ADMIN_WEB_APP_URL);
  };

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>Member Access Only</Text>
        <Text style={styles.subtitle}>This app is for athlete members. Use the Ukali Admin website for admin sign-in.</Text>
        <TouchableOpacity style={styles.buttonPrimary} onPress={() => void openAdminWeb()}>
          <Text style={styles.buttonText}>Open Ukali Admin</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => void signOut()}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 20
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 10
  },
  subtitle: {
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20
  },
  buttonPrimary: {
    backgroundColor: theme.colors.accentMutedTranslucent,
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 12
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14
  },
  buttonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
  }
});
