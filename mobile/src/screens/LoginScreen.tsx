import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Linking } from "react-native";
import { useAuth } from "../context/AuthContext";
import { theme, shadow } from "../theme";
import { APP_ACCESS_SUBTITLE, APP_DISPLAY_NAME, ATHLETE_APP_DEEP_LINK_URL, IS_COACH_APP } from "../config/appVariant";
import TabWallpaper from "../components/TabWallpaper";

export default function LoginScreen() {
  const { sendMagicLink, verifyOtp, signInWithPassword, signInWithBiometrics, biometricLoginAvailable, biometricLoginEmail, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sendLink = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await sendMagicLink(email);
      setMessage("Verification code sent. Enter the 6-digit code from your email.");
    } catch (err: any) {
      setError(err?.message || "Could not send verification code");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await verifyOtp(email, code);
    } catch (err: any) {
      setError(err?.message || "Code verification failed");
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordLogin = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await signInWithPassword(email, password);
    } catch (err: any) {
      setError(err?.message || "Password sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const openAthleteApp = async () => {
    try {
      await Linking.openURL(ATHLETE_APP_DEEP_LINK_URL);
    } catch {
      setError("Could not open Ukali Fit member app. Install/open the member app first.");
    }
  };

  const submitBiometricLogin = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await signInWithBiometrics();
    } catch (err: any) {
      setError(err?.message || "Face ID sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <Text style={styles.title}>{APP_DISPLAY_NAME}</Text>
            <Text style={styles.subtitle}>{APP_ACCESS_SUBTITLE}</Text>
            {IS_COACH_APP ? (
              <TouchableOpacity style={styles.adminAppLink} onPress={openAthleteApp} disabled={loading}>
                <Text style={styles.adminAppIcon}>▣</Text>
                <Text style={styles.adminAppLinkText}>Open Member App</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.card}>
            {biometricLoginAvailable ? (
              <>
                <TouchableOpacity style={styles.faceIdButton} onPress={submitBiometricLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.faceIdButtonText}>Use Face ID</Text>}
                </TouchableOpacity>
                <Text style={styles.faceIdHint}>
                  {biometricLoginEmail ? `Quick sign in for ${biometricLoginEmail}` : "Quick sign in with your saved login"}
                </Text>
              </>
            ) : null}

            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeButton, mode === "otp" ? styles.modeButtonActive : null]}
                onPress={() => setMode("otp")}
                disabled={loading}
              >
                <Text style={styles.modeButtonText}>Verification Code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, mode === "password" ? styles.modeButtonActive : null]}
                onPress={() => setMode("password")}
                disabled={loading}
              >
                <Text style={styles.modeButtonText}>Email Password</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              returnKeyType={mode === "otp" ? "send" : "next"}
              value={email}
              onChangeText={setEmail}
            />

            {mode === "otp" ? (
              <>
                <TouchableOpacity style={styles.primaryButton} onPress={sendLink} disabled={loading}>
                  {loading ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.buttonText}>Send Verification Code</Text>}
                </TouchableOpacity>

                <Text style={styles.orText}>Enter one-time code</Text>

                <TextInput
                  style={styles.input}
                  placeholder="6-digit code"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                />

                <TouchableOpacity style={styles.secondaryButton} onPress={submitCode} disabled={loading}>
                  {loading ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.buttonText}>Verify Code</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.orText}>Enter your password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="password"
                  returnKeyType="go"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={() => {
                    if (!loading) {
                      void submitPasswordLogin();
                    }
                  }}
                />
                <TouchableOpacity style={styles.secondaryButton} onPress={submitPasswordLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.buttonText}>Sign In</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!error && authError ? <Text style={styles.error}>{authError}</Text> : null}
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
    flexGrow: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    padding: theme.spacing.xl
  },
  contentWrapper: {
    width: "100%",
    alignSelf: "center",
    maxWidth: 560,
    transform: [{ translateY: -72 }]
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing.lg
  },
  title: {
    fontSize: 48,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 24
  },
  adminAppLink: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMutedTranslucent
  },
  adminAppIcon: {
    color: theme.colors.textPrimary,
    fontSize: 12
  },
  adminAppLinkText: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    fontSize: 13
  },
  card: {
    backgroundColor: theme.colors.surfaceTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...shadow
  },
  faceIdButton: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 14,
    alignItems: "center",
    marginBottom: 8
  },
  faceIdButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  faceIdHint: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12
  },
  modeRow: {
    flexDirection: "row",
    marginHorizontal: -4,
    marginBottom: 12
  },
  modeButton: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: "center"
  },
  modeButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted
  },
  modeButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600"
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    color: theme.colors.textPrimary,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 12
  },
  primaryButton: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 14,
    alignItems: "center"
  },
  secondaryButton: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 14,
    alignItems: "center"
  },
  buttonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
  },
  error: {
    color: theme.colors.danger,
    marginTop: theme.spacing.sm
  },
  message: {
    color: theme.colors.success,
    marginTop: theme.spacing.sm
  },
  orText: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 0.6
  }
});
