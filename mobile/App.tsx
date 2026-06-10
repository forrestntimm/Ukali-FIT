import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import AppErrorBoundary from "./src/components/AppErrorBoundary";
import AppLoadingScreen from "./src/components/AppLoadingScreen";
import AthleteRoot from "./src/app/AthleteRoot";
import CoachRoot from "./src/app/CoachRoot";
import { theme } from "./src/theme";
import { IS_COACH_APP, VARIANT_CONFIG_ERROR } from "./src/config/appVariant";
import { RUNTIME_CONFIG_ERROR } from "./src/config/runtimeConfig";
import { clearLatestFatalError, getLatestFatalError, installGlobalErrorHandler, subscribeToFatalError } from "./src/lib/appCrashHandler";

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true
    })
  });
} catch (error) {
  if (__DEV__) {
    console.warn("[notifications] Failed to set notification handler during app startup.", error);
  }
}

installGlobalErrorHandler();

function AppStatusScreen({
  title,
  message,
  errorDetail,
  onRetry
}: {
  title: string;
  message: string;
  errorDetail?: string | null;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.variantGuard}>
      <AppLoadingScreen title={title} subtitle={message} />
      {errorDetail ? <Text selectable style={styles.errorDetail}>{errorDetail}</Text> : null}
      {onRetry ? (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function App() {
  const [fatalError, setFatalError] = useState<Error | null>(() => getLatestFatalError());
  const [recoveryKey, setRecoveryKey] = useState(0);

  useEffect(() => subscribeToFatalError(setFatalError), []);
  useEffect(() => {
    void Notifications.setBadgeCountAsync(0).catch((error) => {
      if (__DEV__) {
        console.warn("[notifications] Failed to clear app badge on open.", error);
      }
    });
  }, []);

  const handleRetry = () => {
    clearLatestFatalError();
    setFatalError(null);
    setRecoveryKey((current) => current + 1);
  };

  if (VARIANT_CONFIG_ERROR || RUNTIME_CONFIG_ERROR) {
    return (
      <AppStatusScreen
        title={VARIANT_CONFIG_ERROR ? "App Variant Not Configured" : "App Configuration Missing"}
        message={VARIANT_CONFIG_ERROR || RUNTIME_CONFIG_ERROR || "Unknown configuration error"}
      />
    );
  }

  if (fatalError) {
    return (
      <AppStatusScreen
        title="App Error"
        message="The app hit an unexpected problem while loading. Please close and reopen it."
        errorDetail={fatalError.message}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <AppErrorBoundary key={recoveryKey} onRetry={handleRetry}>
      <AuthProvider>
        <SafeAreaProvider>
          <NavigationContainer
            theme={{
              dark: true,
              colors: {
                primary: theme.colors.accent,
                background: theme.colors.background,
                card: theme.colors.surface,
                text: theme.colors.textPrimary,
                border: theme.colors.border,
                notification: theme.colors.danger
              }
            }}
          >
            {IS_COACH_APP ? <CoachRoot /> : <AthleteRoot />}
          </NavigationContainer>
        </SafeAreaProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  variantGuard: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  errorDetail: {
    color: theme.colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
    paddingHorizontal: 24,
    textAlign: "center"
  },
  retryButton: {
    marginTop: 20,
    alignSelf: "center",
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  retryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600"
  }
});
