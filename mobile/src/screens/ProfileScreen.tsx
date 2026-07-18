import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as Device from "expo-device";
import { NativeModulesProxy } from "expo-modules-core";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import TabWallpaper from "../components/TabWallpaper";
import { useAuth } from "../context/AuthContext";
import { IS_COACH_APP } from "../config/appVariant";
import { useStaleFocusRefresh } from "../hooks/useStaleFocusRefresh";
import { syncRegisteredPushToken } from "../lib/pushNotifications";
import { peekScreenCache, readScreenCache, writeScreenCache } from "../lib/screenCache";
import { shadow, theme } from "../theme";
import { formatDateTimeInAppTimeZone } from "../utils/timezone";

type CoachClassAssignment = {
  id: string;
  title: string;
  datetime: string;
  status: "OPEN" | "CLOSED" | "CANCELED";
};

type PersonalRecords = {
  deadlift?: string | null;
  backSquat?: string | null;
  frontSquat?: string | null;
  cleans?: string | null;
  pushPress?: string | null;
  strictPress?: string | null;
  pushJerk?: string | null;
  benchPress?: string | null;
  oneMileRun?: string | null;
  fiveKilometerRun?: string | null;
};

type PersonalRecordKey = keyof PersonalRecords;

type ActiveEditor = "profile" | "password" | null;

type AdminProfileCacheEnvelope = {
  classesCoached: number;
  coachSchedule: CoachClassAssignment[];
  savedAt: number;
};

const PR_FIELDS: Array<{ key: PersonalRecordKey; label: string; placeholder: string }> = [
  { key: "deadlift", label: "Deadlift", placeholder: "e.g. 405 lb" },
  { key: "backSquat", label: "Back Squat", placeholder: "e.g. 365 lb" },
  { key: "frontSquat", label: "Front Squat", placeholder: "e.g. 295 lb" },
  { key: "cleans", label: "Cleans", placeholder: "e.g. 225 lb" },
  { key: "pushPress", label: "Push Press", placeholder: "e.g. 185 lb" },
  { key: "strictPress", label: "Strict Press", placeholder: "e.g. 145 lb" },
  { key: "pushJerk", label: "Push Jerk", placeholder: "e.g. 205 lb" },
  { key: "benchPress", label: "Bench Press", placeholder: "e.g. 245 lb" },
  { key: "oneMileRun", label: "1 Mile Run", placeholder: "e.g. 6:45" },
  { key: "fiveKilometerRun", label: "5km Run", placeholder: "e.g. 24:30" }
];

function normalizePersonalRecords(personalRecords?: PersonalRecords | null): Record<PersonalRecordKey, string> {
  return {
    deadlift: personalRecords?.deadlift || "",
    backSquat: personalRecords?.backSquat || "",
    frontSquat: personalRecords?.frontSquat || "",
    cleans: personalRecords?.cleans || "",
    pushPress: personalRecords?.pushPress || "",
    strictPress: personalRecords?.strictPress || "",
    pushJerk: personalRecords?.pushJerk || "",
    benchPress: personalRecords?.benchPress || "",
    oneMileRun: personalRecords?.oneMileRun || "",
    fiveKilometerRun: personalRecords?.fiveKilometerRun || ""
  };
}

function buildPersonalRecordsPayload(inputs: Record<PersonalRecordKey, string>): PersonalRecords {
  return PR_FIELDS.reduce<PersonalRecords>((acc, field) => {
    const value = inputs[field.key].trim();
    acc[field.key] = value.length > 0 ? value : null;
    return acc;
  }, {});
}

export default function ProfileScreen() {
  const { user, signOut, setPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const shouldShowCoachSections = IS_COACH_APP && user?.role === "ADMIN";
  const cardSurfaceStyle = shouldShowCoachSections ? styles.adminCard : null;
  const elevatedSurfaceStyle = shouldShowCoachSections ? styles.adminElevatedSurface : null;
  const GOALS_TEXTAREA_MIN_HEIGHT = 48;
  const GOALS_TEXTAREA_VERTICAL_BUFFER = 8;
  const initialCoachCache = peekScreenCache<AdminProfileCacheEnvelope>("admin-profile");
  const [token, setToken] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<ActiveEditor>(null);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [goalsInput, setGoalsInput] = useState("");
  const [goalsInputHeight, setGoalsInputHeight] = useState(GOALS_TEXTAREA_MIN_HEIGHT);
  const [profileImageDataUrl, setProfileImageDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [isPrExpanded, setIsPrExpanded] = useState(false);
  const [personalRecords, setPersonalRecords] = useState<Record<PersonalRecordKey, string>>(
    normalizePersonalRecords(user?.personalRecords)
  );
  const [savingPersonalRecords, setSavingPersonalRecords] = useState(false);
  const [classesCoached, setClassesCoached] = useState(initialCoachCache?.classesCoached || 0);
  const [loadingCoachStats, setLoadingCoachStats] = useState(false);
  const [coachSchedule, setCoachSchedule] = useState<CoachClassAssignment[]>(initialCoachCache?.coachSchedule || []);
  const [loadingCoachSchedule, setLoadingCoachSchedule] = useState(false);

  const loadCoachProfile = useCallback(async () => {
    if (!shouldShowCoachSections || !user) return;

    setLoadingCoachStats((current) => current || classesCoached === 0);
    setLoadingCoachSchedule((current) => current || coachSchedule.length === 0);
    try {
      const [statsRes, scheduleRes] = await Promise.all([
        api.get("/users/me/coach-stats"),
        api.get("/classes", { params: { mine: "true", summary: "true", limit: "20" } })
      ]);
      const nextClassesCoached = Number(statsRes.data?.classesCoached || 0);
      const assignments = (scheduleRes.data as CoachClassAssignment[]).filter((item) => item.status !== "CANCELED");
      setClassesCoached(nextClassesCoached);
      setCoachSchedule(assignments);
      await writeScreenCache<AdminProfileCacheEnvelope>("admin-profile", {
        classesCoached: nextClassesCoached,
        coachSchedule: assignments,
        savedAt: Date.now()
      });
    } finally {
      setLoadingCoachStats(false);
      setLoadingCoachSchedule(false);
    }
  }, [classesCoached, coachSchedule.length, shouldShowCoachSections, user]);

  const { seedLoadedAt } = useStaleFocusRefresh(loadCoachProfile, 5 * 60 * 1000);

  useEffect(() => {
    void (async () => {
      try {
        const pushToken = await syncRegisteredPushToken();
        if (!pushToken) return;
        setToken(pushToken);
      } catch (error) {
        console.error("[profile] Failed to register device notifications", error);
      }
    })();
  }, []);

  useEffect(() => {
    setNameInput(user?.name || "");
    setAgeInput(user?.age != null ? String(user.age) : "");
    setGoalsInput(user?.fitnessGoals || "");
    setProfileImageDataUrl(user?.profileImageDataUrl || null);
    setGoalsInputHeight(GOALS_TEXTAREA_MIN_HEIGHT);
    setPersonalRecords(normalizePersonalRecords(user?.personalRecords));
  }, [user?.name, user?.age, user?.fitnessGoals, user?.profileImageDataUrl, user?.personalRecords]);

  useEffect(() => {
    if (!shouldShowCoachSections || !user) {
      setClassesCoached(0);
      setCoachSchedule([]);
      return;
    }

    void (async () => {
      const cached = await readScreenCache<AdminProfileCacheEnvelope>("admin-profile");
      if (!cached) return;
      setClassesCoached(cached.classesCoached || 0);
      setCoachSchedule(cached.coachSchedule || []);
      if (cached.savedAt) {
        seedLoadedAt(cached.savedAt);
      }
    })();
  }, [seedLoadedAt, shouldShowCoachSections, user]);

  const openEditor = (editor: Exclude<ActiveEditor, null>) => {
    setStatusMessage(null);
    setIsEditMenuOpen(false);
    setActiveEditor(editor);
  };

  const closeEditor = () => {
    setActiveEditor(null);
    setStatusMessage(null);
  };

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

    const trimmedName = nameInput.trim();
    if (trimmedName.length < 2) {
      setSaving(false);
      Alert.alert("Invalid name", "Name must be at least 2 characters.");
      return;
    }

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
        name: trimmedName,
        profileImageDataUrl,
        age,
        fitnessGoals
      });
      setNameInput(res.data?.name || "");
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

  const savePersonalRecords = async () => {
    if (!user) return;
    setStatusMessage(null);
    setSavingPersonalRecords(true);

    try {
      const payload = buildPersonalRecordsPayload(personalRecords);
      await api.patch("/users/me", {
        personalRecords: payload
      });
      setPersonalRecords(normalizePersonalRecords(payload));
      setStatusMessage("PRs saved.");
    } catch (err: any) {
      setStatusMessage(err?.response?.data?.message || "Could not save PRs.");
    } finally {
      setSavingPersonalRecords(false);
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
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 112 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.editMenuAnchor}>
            <TouchableOpacity style={[styles.editButton, elevatedSurfaceStyle]} onPress={() => setIsEditMenuOpen((prev) => !prev)}>
              <Text style={styles.editButtonLabel}>Edit</Text>
            </TouchableOpacity>
            {isEditMenuOpen ? (
              <View style={styles.editMenu}>
                <TouchableOpacity style={styles.editMenuItem} onPress={() => openEditor("profile")}>
                  <Text style={styles.editMenuItemText}>Athlete Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editMenuItem} onPress={() => openEditor("password")}>
                  <Text style={styles.editMenuItemText}>Password Login</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.title}>{user?.name || "Client"}</Text>
        <Text style={styles.subText}>{user?.email}</Text>

        <View style={[styles.card, cardSurfaceStyle]}>
          <Text style={styles.cardTitle}>Athlete Profile</Text>
          <View style={styles.profileSummaryRow}>
            {profileImageDataUrl ? (
              <Image source={{ uri: profileImageDataUrl }} style={styles.summaryAvatar} />
            ) : (
              <View style={[styles.summaryAvatar, styles.avatarPlaceholder, elevatedSurfaceStyle]}>
                <Text style={styles.avatarPlaceholderText}>No photo</Text>
              </View>
            )}
            <View style={styles.profileSummaryText}>
              <Text style={styles.subText}>Age: {user?.age ?? "Not set"}</Text>
              <Text style={styles.subText}>Fitness Goals: {user?.fitnessGoals || "Not set"}</Text>
              <Text style={styles.subText}>Days Left In Membership: {user?.daysLeftInMembership ?? 0}</Text>
            </View>
          </View>
        </View>

        {shouldShowCoachSections ? (
          <>
            <View style={[styles.card, cardSurfaceStyle]}>
              <Text style={styles.cardTitle}>Coach Stats</Text>
              <Text style={styles.subText}>Classes Coached: {loadingCoachStats ? "Loading..." : classesCoached}</Text>
            </View>
            <View style={[styles.card, cardSurfaceStyle]}>
              <Text style={styles.cardTitle}>Upcoming Coaching Schedule</Text>
              {loadingCoachSchedule ? <Text style={styles.subText}>Loading upcoming coaching assignments...</Text> : null}
              {!loadingCoachSchedule && coachSchedule.length === 0 ? (
                <Text style={styles.subText}>No upcoming coaching assignments yet.</Text>
              ) : null}
              {!loadingCoachSchedule
                ? coachSchedule.map((item) => (
                    <View key={item.id} style={styles.scheduleRow}>
                      <Text style={styles.scheduleTitle}>{item.title}</Text>
                      <Text style={styles.subText}>{formatDateTimeInAppTimeZone(item.datetime)}</Text>
                    </View>
                  ))
                : null}
            </View>
          </>
        ) : null}

        <View style={[styles.card, cardSurfaceStyle]}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => setIsPrExpanded((prev) => !prev)}>
            <View style={styles.expandableHeader}>
              <Text style={styles.cardTitle}>PR</Text>
              <Text style={styles.expandableHeaderLabel}>{isPrExpanded ? "COLLAPSE" : "EXPAND"}</Text>
            </View>
            <Text style={styles.subText}>
              {isPrExpanded ? "Update your latest lifts and run times." : "Tap to expand and record your PRs."}
            </Text>
          </TouchableOpacity>
          {isPrExpanded ? (
            <View style={styles.prFields}>
              {PR_FIELDS.map((field) => (
                <View key={field.key}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    style={[styles.input, elevatedSurfaceStyle]}
                    placeholder={field.placeholder}
                    placeholderTextColor={theme.colors.textSecondary}
                    value={personalRecords[field.key]}
                    onChangeText={(text) =>
                      setPersonalRecords((current) => ({
                        ...current,
                        [field.key]: text
                      }))
                    }
                  />
                </View>
              ))}
              <TouchableOpacity style={[styles.secondaryButton, elevatedSurfaceStyle]} onPress={savePersonalRecords} disabled={savingPersonalRecords}>
                {savingPersonalRecords ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.buttonText}>Save PRs</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {token ? <Text style={styles.subText}>Notifications enabled</Text> : <Text style={styles.subText}>Notifications pending</Text>}

        <TouchableOpacity style={styles.button} onPress={signOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal transparent animationType="fade" visible={activeEditor !== null} onRequestClose={closeEditor}>
        <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={closeEditor}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalCard, cardSurfaceStyle]} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeEditor === "profile" ? "Athlete Profile" : "Password Login"}</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeEditor}>
                <Text style={styles.modalCloseButtonLabel}>Done</Text>
              </TouchableOpacity>
            </View>

            {activeEditor === "profile" ? (
              <>
                {profileImageDataUrl ? (
                  <Image source={{ uri: profileImageDataUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, elevatedSurfaceStyle]}>
                    <Text style={styles.avatarPlaceholderText}>No photo</Text>
                  </View>
                )}
                <TouchableOpacity style={[styles.secondaryButton, elevatedSurfaceStyle]} onPress={pickFromGallery} disabled={pickingImage}>
                  {pickingImage ? (
                    <ActivityIndicator color={theme.colors.textPrimary} />
                  ) : (
                    <Text style={styles.buttonText}>Choose From Gallery</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={[styles.input, elevatedSurfaceStyle]}
                  placeholder="Name"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={nameInput}
                  onChangeText={setNameInput}
                />

                <Text style={styles.fieldLabel}>Age</Text>
                <TextInput
                  style={[styles.input, elevatedSurfaceStyle]}
                  keyboardType="number-pad"
                  placeholder="Age"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={ageInput}
                  onChangeText={setAgeInput}
                />

                <Text style={styles.fieldLabel}>Fitness Goals</Text>
                <TextInput
                  style={[styles.input, elevatedSurfaceStyle, styles.textArea, { height: goalsInputHeight }]}
                  multiline
                  scrollEnabled={false}
                  placeholder="Your goals"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={goalsInput}
                  onChangeText={(text) => {
                    setGoalsInput(text);
                    if (text.trim().length === 0) {
                      setGoalsInputHeight(GOALS_TEXTAREA_MIN_HEIGHT);
                    }
                  }}
                  onContentSizeChange={(event) => {
                    const nextHeight = Math.max(
                      GOALS_TEXTAREA_MIN_HEIGHT,
                      Math.ceil(event.nativeEvent.contentSize.height + GOALS_TEXTAREA_VERTICAL_BUFFER)
                    );
                    if (nextHeight !== goalsInputHeight) {
                      setGoalsInputHeight(nextHeight);
                    }
                  }}
                />

                <TouchableOpacity style={[styles.secondaryButton, elevatedSurfaceStyle]} onPress={saveProfile} disabled={saving}>
                  {saving ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.buttonText}>Save Athlete Profile</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.subText}>Set your password once, then sign in from the Email Password tab.</Text>
                <Text style={styles.fieldLabel}>New Password</Text>
                <TextInput
                  style={[styles.input, elevatedSurfaceStyle]}
                  placeholder="New password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  passwordRules="minlength: 8;"
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <Text style={styles.fieldLabel}>Confirm Password</Text>
                <TextInput
                  style={[styles.input, elevatedSurfaceStyle]}
                  placeholder="Confirm password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  passwordRules="minlength: 8;"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity style={[styles.secondaryButton, elevatedSurfaceStyle]} onPress={savePassword} disabled={updatingPassword}>
                  {updatingPassword ? <ActivityIndicator color={theme.colors.textPrimary} /> : <Text style={styles.buttonText}>Save Password</Text>}
                </TouchableOpacity>
              </>
            )}

            {statusMessage ? <Text style={styles.subText}>{statusMessage}</Text> : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginLeft: -4,
    zIndex: 20
  },
  editMenuAnchor: {
    position: "relative",
    alignSelf: "flex-start"
  },
  editButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surfaceElevatedTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadow
  },
  editButtonLabel: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  editMenu: {
    position: "absolute",
    top: 48,
    left: 0,
    minWidth: 180,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    ...shadow
  },
  editMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1
  },
  editMenuItemText: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
  },
  heading: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 12,
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
  scheduleRow: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 10
  },
  scheduleTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  expandableHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  expandableHeaderLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8
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
  adminCard: {
    backgroundColor: theme.colors.adminSurfaceTranslucent
  },
  adminElevatedSurface: {
    backgroundColor: theme.colors.adminSurfaceElevatedTranslucent
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    marginBottom: 4
  },
  profileSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  profileSummaryText: {
    flex: 1
  },
  summaryAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36
  },
  avatar: {
    width: 180,
    height: 180,
    borderRadius: 90,
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
    textAlignVertical: "top"
  },
  prFields: {
    marginTop: 8,
    gap: 2
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: 16,
    ...shadow
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700"
  },
  modalCloseButton: {
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  modalCloseButtonLabel: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  }
});
