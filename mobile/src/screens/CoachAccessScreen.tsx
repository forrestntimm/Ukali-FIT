import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import TabWallpaper from "../components/TabWallpaper";
import { theme } from "../theme";

export default function CoachAccessScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>Admin Access Required</Text>
        <Text style={styles.subtitle}>
          This app is for admin accounts only. Sign in with an admin account to continue.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => void signOut()}>
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
  button: {
    backgroundColor: theme.colors.accentMutedTranslucent,
    borderColor: theme.colors.accent,
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
