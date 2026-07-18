import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Camera, CameraType } from "expo-camera";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import TabWallpaper from "../components/TabWallpaper";
import { useAuth } from "../context/AuthContext";
import { useStaleFocusRefresh } from "../hooks/useStaleFocusRefresh";
import { peekScreenCache, readScreenCache, writeScreenCache } from "../lib/screenCache";
import { theme, shadow } from "../theme";
import { formatDateTimeInAppTimeZone, toDayKeyInAppTimeZone } from "../utils/timezone";

type ClassItem = {
  id: string;
  title: string;
  datetime: string;
  status: "OPEN" | "CLOSED" | "CANCELED";
  capacity: number;
  reservationCount?: number;
  checkedInCount?: number;
};

type CheckInResponse = {
  status: "CHECKED_IN" | "ALREADY_CHECKED_IN";
  checkInAt: string;
  klass: { id: string; title: string; datetime: string };
  member: { id: string; name: string; email: string; checkInQrCode: string };
  workoutLog: {
    id: string;
    checkedInAt: string;
    weight?: string | null;
    completionTime?: string | null;
    movementScales?: string | null;
    coachNotes?: string | null;
    workout?: {
      id: string;
      date: string;
      description: string;
    } | null;
  };
};

type PerformanceForm = {
  weight: string;
  completionTime: string;
  movementScales: string;
  coachNotes: string;
};

type ClassSignupItem = {
  id: string;
  createdAt: string;
  checkedInAt?: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    paymentStatus?: "PAID" | "UNPAID";
    checkInQrCode?: string;
  };
};

type AdminScanCacheEnvelope = {
  classes: ClassItem[];
  selectedClassId: string;
  classRoster: ClassSignupItem[];
  savedAt: number;
};

export default function AdminScanScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const initialCached = peekScreenCache<AdminScanCacheEnvelope>("admin-scan");
  const [classes, setClasses] = useState<ClassItem[]>(initialCached?.classes || []);
  const [selectedClassId, setSelectedClassId] = useState<string>(initialCached?.selectedClassId || "");
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualQrCode, setManualQrCode] = useState("");
  const [classRoster, setClassRoster] = useState<ClassSignupItem[]>(initialCached?.classRoster || []);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [selectedRosterUserId, setSelectedRosterUserId] = useState("");
  const [rosterDropdownOpen, setRosterDropdownOpen] = useState(false);
  const [lastCheckedInQrCode, setLastCheckedInQrCode] = useState("");
  const [lastCheckedInMemberName, setLastCheckedInMemberName] = useState("");
  const [performance, setPerformance] = useState<PerformanceForm>({
    weight: "",
    completionTime: "",
    movementScales: "",
    coachNotes: ""
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadClassRoster = useCallback(async (classId: string) => {
    if (!classId) {
      setClassRoster([]);
      setSelectedRosterUserId("");
      return;
    }
    setLoadingRoster(true);
    try {
      const res = await api.get(`/classes/${classId}/signups`);
      const roster = res.data as ClassSignupItem[];
      setClassRoster(roster);
      await writeScreenCache<AdminScanCacheEnvelope>("admin-scan", {
        classes,
        selectedClassId: classId,
        classRoster: roster,
        savedAt: Date.now()
      });
      if (selectedRosterUserId && !roster.some((signup) => signup.user?.id === selectedRosterUserId)) {
        setSelectedRosterUserId("");
      }
    } catch {
      setClassRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedRosterUserId]);

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const res = await api.get("/classes", { params: { mine: "true", summary: "true", limit: "20" } });
      const all = (res.data as ClassItem[]).filter((item) => item.status !== "CANCELED");
      const todayKey = toDayKeyInAppTimeZone(new Date());
      const todayClasses = all.filter((item) => toDayKeyInAppTimeZone(item.datetime) === todayKey);
      const options = todayClasses.length > 0 ? todayClasses : all.slice(0, 12);
      setClasses(options);
      const nextSelectedClassId = options.find((item) => item.id === selectedClassId)
        ? selectedClassId
        : options[0]?.id || "";
      setSelectedClassId(nextSelectedClassId);
      await loadClassRoster(nextSelectedClassId);
      await writeScreenCache<AdminScanCacheEnvelope>("admin-scan", {
        classes: options,
        selectedClassId: nextSelectedClassId,
        classRoster,
        savedAt: Date.now()
      });
    } finally {
      setLoadingClasses(false);
    }
  }, [loadClassRoster, selectedClassId]);

  const { seedLoadedAt } = useStaleFocusRefresh(loadClasses, 5 * 60 * 1000);

  useEffect(() => {
    void (async () => {
      const cached = await readScreenCache<AdminScanCacheEnvelope>("admin-scan");
      if (!cached) return;
      setClasses(cached.classes || []);
      setSelectedClassId(cached.selectedClassId || "");
      setClassRoster(cached.classRoster || []);
      if (cached.savedAt) {
        seedLoadedAt(cached.savedAt);
      }
    })();
  }, [seedLoadedAt]);

  useFocusEffect(
    useCallback(() => {
      if (!selectedClassId) return;
      void loadClassRoster(selectedClassId);
      const interval = setInterval(() => {
        void loadClassRoster(selectedClassId);
      }, 15000);
      return () => clearInterval(interval);
    }, [loadClassRoster, selectedClassId])
  );

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  );
  const selectedRosterSignup = useMemo(
    () => classRoster.find((signup) => signup.user?.id === selectedRosterUserId) || null,
    [classRoster, selectedRosterUserId]
  );

  const submitCheckIn = useCallback(
    async (rawCode: string, options?: { savePerformance?: boolean }) => {
      const qrCode = rawCode.trim();
      if (!qrCode || !selectedClassId || submitting) return;

      setSubmitting(true);
      setStatusError(null);
      try {
        const requestPayload: {
          qrCode: string;
          weight?: string;
          completionTime?: string;
          movementScales?: string;
          coachNotes?: string;
        } = { qrCode };

        if (options?.savePerformance) {
          const weight = performance.weight.trim();
          const completionTime = performance.completionTime.trim();
          const movementScales = performance.movementScales.trim();
          const coachNotes = performance.coachNotes.trim();
          if (weight) requestPayload.weight = weight;
          if (completionTime) requestPayload.completionTime = completionTime;
          if (movementScales) requestPayload.movementScales = movementScales;
          if (coachNotes) requestPayload.coachNotes = coachNotes;
        }

        const res = await api.post<CheckInResponse>(`/classes/${selectedClassId}/checkin`, requestPayload);
        const response = res.data;
        const message = `${response.member.name} • ${formatDateTimeInAppTimeZone(response.checkInAt)}`;
        setLastCheckedInQrCode(qrCode);
        setLastCheckedInMemberName(response.member.name);
        setSelectedRosterUserId(response.member.id);
        setPerformance({
          weight: response.workoutLog.weight || "",
          completionTime: response.workoutLog.completionTime || "",
          movementScales: response.workoutLog.movementScales || "",
          coachNotes: response.workoutLog.coachNotes || ""
        });

        setStatusMessage(
          options?.savePerformance
            ? `Workout data saved for ${response.member.name}.`
            : response.status === "ALREADY_CHECKED_IN"
            ? `Already checked in: ${message}`
            : `Checked in: ${message}`
        );
        setManualQrCode("");
        if (!options?.savePerformance) {
          Alert.alert(
            response.status === "ALREADY_CHECKED_IN" ? "Already Checked In" : "Check-in Confirmed",
            message
          );
        }
        await loadClasses();
        await loadClassRoster(selectedClassId);
      } catch (err: any) {
        const message = err?.response?.data?.message || "Unable to save check-in.";
        setStatusError(message);
        if (!options?.savePerformance) {
          Alert.alert("Check-in Failed", message);
        }
      } finally {
        setSubmitting(false);
        setScanLocked(true);
        setTimeout(() => setScanLocked(false), 1500);
      }
    },
    [loadClassRoster, loadClasses, performance.coachNotes, performance.completionTime, performance.movementScales, performance.weight, selectedClassId, submitting]
  );

  const checkedInCount = classRoster.filter((item) => item.checkedInAt).length;
  const reservedCount = classRoster.length || selectedClass?.reservationCount || 0;
  const selectedAthleteQrCode = selectedRosterSignup?.user?.checkInQrCode || lastCheckedInQrCode;
  const selectedAthleteName = selectedRosterSignup?.user?.name || lastCheckedInMemberName;

  if (user?.role !== "ADMIN") {
    return (
      <View style={styles.screen}>
        <TabWallpaper />
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title}>Admin Scanner</Text>
          <Text style={styles.subtitle}>This screen is only available to admin users.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TabWallpaper />
      <ScrollView style={[styles.container, { paddingTop: insets.top + 8 }]} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Admin Scanner</Text>
        <Text style={styles.subtitle}>Select class, then scan member QR to check in.</Text>

        {classes.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No Assigned Classes</Text>
            <Text style={styles.subText}>
              You have no classes assigned. Ask an approved admin to assign your class schedule.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Class Session</Text>
          {loadingClasses ? <ActivityIndicator color={theme.colors.textPrimary} /> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classList}>
            {classes.map((item) => {
              const active = item.id === selectedClassId;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.classChip, active && styles.classChipActive]}
                  onPress={() => {
                    setSelectedClassId(item.id);
                    setRosterDropdownOpen(false);
                    void loadClassRoster(item.id);
                  }}
                >
                  <Text style={[styles.classChipTitle, active && styles.classChipTitleActive]}>{item.title}</Text>
                  <Text style={[styles.classChipSub, active && styles.classChipTitleActive]}>
                    {formatDateTimeInAppTimeZone(item.datetime)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {selectedClass ? (
            <Text style={styles.subText}>
              Reserved {reservedCount}/{selectedClass.capacity} • Checked in {checkedInCount}
            </Text>
          ) : (
            <Text style={styles.subText}>No class available to scan right now.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Camera Scan</Text>
          {!permission ? (
            <ActivityIndicator color={theme.colors.textPrimary} />
          ) : null}

          {permission && !permission.granted ? (
            <TouchableOpacity style={styles.button} onPress={() => requestPermission()}>
              <Text style={styles.buttonText}>Enable Camera</Text>
            </TouchableOpacity>
          ) : null}

          {permission?.granted ? (
            <View style={styles.cameraWrap}>
              <Camera
                style={styles.camera}
                type={CameraType.back}
                barCodeScannerSettings={{ barCodeTypes: ["qr"] }}
                onBarCodeScanned={scanLocked || submitting || !selectedClassId ? undefined : ({ data }) => void submitCheckIn(data)}
              />
            </View>
          ) : null}

          <Text style={styles.subText}>Point camera at the member QR block on their Dashboard.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manual QR Entry (Fallback)</Text>
          <TextInput
            value={manualQrCode}
            onChangeText={setManualQrCode}
            placeholder="Paste QR code"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <TouchableOpacity
            style={[styles.button, (!manualQrCode.trim() || !selectedClassId || submitting) && styles.buttonDisabled]}
            onPress={() => void submitCheckIn(manualQrCode)}
            disabled={!manualQrCode.trim() || !selectedClassId || submitting}
          >
            <Text style={styles.buttonText}>{submitting ? "Saving..." : "Check In Member"}</Text>
          </TouchableOpacity>
          {statusMessage ? <Text style={styles.successText}>{statusMessage}</Text> : null}
          {statusError ? <Text style={styles.errorText}>{statusError}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Workout Data (After Check-In)</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setRosterDropdownOpen((prev) => !prev)}
            disabled={loadingRoster || !selectedClassId}
          >
            <Text style={styles.dropdownButtonText}>
              {loadingRoster
                ? "Loading athletes..."
                : selectedRosterSignup?.user?.name
                ? `Athlete: ${selectedRosterSignup.user.name}`
                : "Select reserved athlete"}
            </Text>
          </TouchableOpacity>
          {rosterDropdownOpen ? (
            <View style={styles.dropdownList}>
              {classRoster.length === 0 ? <Text style={styles.subText}>No reserved athletes yet.</Text> : null}
              {classRoster.map((signup) => (
                <TouchableOpacity
                  key={signup.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    const qr = signup.user?.checkInQrCode || "";
                    setSelectedRosterUserId(signup.user?.id || "");
                    setLastCheckedInQrCode(qr);
                    setLastCheckedInMemberName(signup.user?.name || "");
                    setRosterDropdownOpen(false);
                  }}
                >
                  <Text style={styles.dropdownItemTitle}>{signup.user?.name || "Unknown"}</Text>
                  <Text style={styles.dropdownItemSub}>
                    {signup.user?.paymentStatus || "UNPAID"} • {signup.checkedInAt ? "Checked in" : "Not checked in"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <Text style={styles.subText}>
            {selectedAthleteQrCode
              ? `Saving results for ${selectedAthleteName || "selected athlete"}.`
              : "Scan, select an athlete, or manually check in first."}
          </Text>
          <TextInput
            value={performance.weight}
            onChangeText={(value) => setPerformance((prev) => ({ ...prev, weight: value }))}
            placeholder="Weight (example: 85kg)"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={performance.completionTime}
            onChangeText={(value) => setPerformance((prev) => ({ ...prev, completionTime: value }))}
            placeholder="Time (example: 12:34)"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={performance.movementScales}
            onChangeText={(value) => setPerformance((prev) => ({ ...prev, movementScales: value }))}
            placeholder="Movement scales"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={performance.coachNotes}
            onChangeText={(value) => setPerformance((prev) => ({ ...prev, coachNotes: value }))}
            placeholder="Coach notes"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.input, styles.multiLineInput]}
            multiline
          />
          <TouchableOpacity
            style={[styles.button, (!selectedAthleteQrCode || submitting) && styles.buttonDisabled]}
            onPress={() => void submitCheckIn(selectedAthleteQrCode, { savePerformance: true })}
            disabled={!selectedAthleteQrCode || submitting}
          >
            <Text style={styles.buttonText}>{submitting ? "Saving..." : "Save Workout Data"}</Text>
          </TouchableOpacity>
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
    marginBottom: 10
  },
  classList: {
    marginBottom: 8
  },
  classChip: {
    width: 220,
    marginRight: 8,
    backgroundColor: theme.colors.adminSurfaceTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10
  },
  classChipActive: {
    backgroundColor: theme.colors.adminAccentMutedTranslucent,
    borderColor: theme.colors.accent
  },
  classChipTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    marginBottom: 2
  },
  classChipSub: {
    color: theme.colors.textSecondary,
    fontSize: 12
  },
  classChipTitleActive: {
    color: theme.colors.textPrimary
  },
  subText: {
    color: theme.colors.textSecondary
  },
  cameraWrap: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  camera: {
    width: "100%",
    height: 280
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.textPrimary,
    marginBottom: 10
  },
  multiLineInput: {
    minHeight: 84,
    textAlignVertical: "top"
  },
  dropdownButton: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10
  },
  dropdownButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
  },
  dropdownList: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: theme.colors.adminSurfaceTranslucent,
    marginBottom: 10
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1
  },
  dropdownItemTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "600"
  },
  dropdownItemSub: {
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontSize: 12
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
  successText: {
    color: "#22c55e",
    marginTop: 8
  },
  errorText: {
    color: theme.colors.danger,
    marginTop: 8
  }
});
