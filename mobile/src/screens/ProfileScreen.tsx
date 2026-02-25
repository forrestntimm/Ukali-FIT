import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator } from "react-native";
import * as Device from "expo-device";
import { NativeModulesProxy } from "expo-modules-core";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import TabWallpaper from "../components/TabWallpaper";
import { theme, shadow } from "../theme";

export default function ProfileScreen() {
  const { user, signOut, setPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const [ageInput, setAgeInput] = useState("");
  const [goalsInput, setGoalsInput] = useState("");
  const [profileImageDataUrl, setProfileImageDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    (async () => {
      if (!Device.isDevice) return;
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;

      const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
      setToken(pushToken);
      await api.post("/devices/register", { token: pushToken, platform: Device.osName || "unknown" });
    })();
  }, []);

  useEffect(() => {
    setAgeInput(user?.age != null ? String(user.age) : "");
    setGoalsInput(user?.fitnessGoals || "");
    setProfileImageDataUrl(user?.profileImageDataUrl || null);
  }, [user?.age, user?.fitnessGoals, user?.profileImageDataUrl]);

  const pickFromGallery = async () => {
    setStatusMessage(null);
    const hasImagePickerNative = Boolean((NativeModulesProxy as Record<string, unknown>).ExponentImagePicker);
    if (!hasImagePickerNative) {
      Alert.alert("Photo upload unavailable", "Image picker is not in this iOS build. Rebuild the app after installing CocoaPods.");
      return;
    }

    let imagePicker: any = null;
    try {
      imagePicker = require("expo-image-picker");
    } catch {
      imagePicker = null;
    }

    if (!imagePicker) {
      Alert.alert("Photo upload unavailable", "This build is missing image picker. Rebuild iOS app to enable gallery uploads.");
      return;
    }

    const { status } = await imagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access to set your profile image.");
      return;
    }

    setPickingImage(true);
    try {
      const result = await imagePicker.launchImageLibraryAsync({
        mediaTypes: imagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true
      });

      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        Alert.alert("Image error", "Could not read selected image.");
        return;
      }

      const mimeType = asset.mimeType || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${asset.base64}`;

      if (dataUrl.length > 700000) {
        Alert.alert("Image too large", "Choose a smaller photo.");
        return;
      }

      setProfileImageDataUrl(dataUrl);
    } finally {
      setPickingImage(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setStatusMessage(null);
    setSaving(true);

    const trimmedAge = ageInput.trim();
    let age: number | null = null;
    if (trimmedAge.length > 0) {
      const parsed = Number(trimmedAge);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 120) {
        setSaving(false);
        Alert.alert("Invalid age", "Age must be a whole number between 1 and 120.");
        return;
      }
      age = parsed;
    }

    const trimmedGoals = goalsInput.trim();
    const fitnessGoals = trimmedGoals.length > 0 ? trimmedGoals : null;

    try {
      const res = await api.patch("/users/me", {
        profileImageDataUrl,
        age,
        fitnessGoals
      });
      setAgeInput(res.data?.age != null ? String(res.data.age) : "");
      setGoalsInput(res.data?.fitnessGoals || "");
      setProfileImageDataUrl(res.data?.profileImageDataUrl || null);
      setStatusMessage("Profile saved.");
    } catch (err: any) {
      setStatusMessage(err?.response?.data?.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setStatusMessage(null);
    const nextPassword = newPassword.trim();
    const nextConfirm = confirmPassword.trim();

    if (nextPassword.length < 8) {
      Alert.alert("Password too short", "Password must be at least 8 characters.");
      return;
    }
    if (nextPassword !== nextConfirm) {
      Alert.alert("Password mismatch", "Password and confirmation must match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      await setPassword(nextPassword);
      setNewPassword("");
      setConfirmPassword("");
      setStatusMessage("Password updated. You can now sign in with email and password.");
    } catch (err: any) {
      setStatusMessage(err?.message || "Could not update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 112 }
        ]}
      >
      <Text style={styles.heading}>Profile</Text>
      <Text style={styles.title}>{user?.name || "Client"}</Text>
      <Text style={styles.subText}>{user?.email}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile Photo</Text>
        {profileImageDataUrl ? (
          <Image source={{ uri: profileImageDataUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarPlaceholderText}>No photo</Text>
          </View>
        )}
        <TouchableOpacity style={styles.secondaryButton} onPress={pickFromGallery} disabled={pickingImage}>
          {pickingImage ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.buttonText}>Choose From Gallery</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Client Profile</Text>
        <Text style={styles.fieldLabel}>Age</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="Age"
          placeholderTextColor={theme.colors.textSecondary}
          value={ageInput}
          onChangeText={setAgeInput}
        />

        <Text style={styles.fieldLabel}>Fitness Goals</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder="Your goals"
          placeholderTextColor={theme.colors.textSecondary}
          value={goalsInput}
          onChangeText={setGoalsInput}
        />

        <TouchableOpacity style={styles.secondaryButton} onPress={saveProfile} disabled={saving}>
          {saving ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.buttonText}>Save Profile</Text>}
        </TouchableOpacity>

        {statusMessage ? <Text style={styles.subText}>{statusMessage}</Text> : null}
        <Text style={styles.subText}>Workout Streak: {user?.workoutStreak ?? 0} day(s)</Text>
        <Text style={styles.subText}>Classes Attended: {user?.classesTotalAttended ?? 0}</Text>
        <Text style={styles.subText}>Days Left In Membership: {user?.daysLeftInMembership ?? 0}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Password Login Setup</Text>
        <Text style={styles.subText}>Set your password once, then sign in from the Email Password tab.</Text>
        <Text style={styles.fieldLabel}>New Password</Text>
        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor={theme.colors.textSecondary}
          secureTextEntry
          autoCapitalize="none"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <Text style={styles.fieldLabel}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor={theme.colors.textSecondary}
          secureTextEntry
          autoCapitalize="none"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={savePassword} disabled={updatingPassword}>
          {updatingPassword ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.buttonText}>Save Password</Text>}
        </TouchableOpacity>
      </View>

      {token ? <Text style={styles.subText}>Notifications enabled</Text> : <Text style={styles.subText}>Notifications pending</Text>}

      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
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
    backgroundColor: "transparent"
  },
  contentContainer: {
    paddingHorizontal: 24
  },
  heading: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "700"
  },
  subText: {
    color: theme.colors.textSecondary,
    marginTop: 6
  },
  card: {
    marginTop: 16,
    backgroundColor: theme.colors.surfaceTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 12,
    ...shadow
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    marginBottom: 4
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginTop: 8,
    marginBottom: 10,
    alignSelf: "center"
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surfaceElevatedTranslucent,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center"
  },
  avatarPlaceholderText: {
    color: theme.colors.textSecondary
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    marginTop: 8,
    marginBottom: 6,
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 0.6
  },
  input: {
    backgroundColor: theme.colors.surfaceElevatedTranslucent,
    color: theme.colors.textPrimary,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 12
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top"
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: theme.colors.surfaceElevatedTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 12,
    alignItems: "center"
  },
  button: {
    marginTop: 24,
    backgroundColor: "#3C2426",
    borderColor: theme.colors.danger,
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  buttonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
  }
});
