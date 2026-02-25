import React, { useCallback, useMemo, useState } from "react";
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
import { theme, shadow } from "../theme";
import { formatDateTimeInAppTimeZone, toDayKeyInAppTimeZone } from "../utils/timezone";

type ClassItem = {
  id: string;
  title: string;
  datetime: string;
  status: "OPEN" | "CLOSED" | "CANCELED";
  capacity: number;
  signups?: Array<{ checkedInAt?: string | null }>;
};

type CheckInResponse = {
  status: "CHECKED_IN" | "ALREADY_CHECKED_IN";
  checkInAt: string;
  klass: { id: string; title: string; datetime: string };
  member: { id: string; name: string; email: string; checkInQrCode: string };
};

export default function AdminScanScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualQrCode, setManualQrCode] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const res = await api.get("/classes");
      const all = (res.data as ClassItem[]).filter((item) => item.status !== "CANCELED");
      const todayKey = toDayKeyInAppTimeZone(new Date());
      const todayClasses = all.filter((item) => toDayKeyInAppTimeZone(item.datetime) === todayKey);
      const options = todayClasses.length > 0 ? todayClasses : all.slice(0, 12);
      setClasses(options);
      if (!options.find((item) => item.id === selectedClassId)) {
        setSelectedClassId(options[0]?.id || "");
      }
    } finally {
      setLoadingClasses(false);
    }
  }, [selectedClassId]);

  useFocusEffect(
    useCallback(() => {
      void loadClasses();
    }, [loadClasses])
  );

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const submitCheckIn = useCallback(
    async (rawCode: string) => {
      const qrCode = rawCode.trim();
      if (!qrCode || !selectedClassId || submitting) return;

      setSubmitting(true);
      setStatusError(null);
      try {
        const res = await api.post<CheckInResponse>(`/classes/${selectedClassId}/checkin`, { qrCode });
        const payload = res.data;
        const message = `${payload.member.name} • ${formatDateTimeInAppTimeZone(payload.checkInAt)}`;
        setStatusMessage(
          payload.status === "ALREADY_CHECKED_IN"
            ? `Already checked in: ${message}`
            : `Checked in: ${message}`
        );
        setManualQrCode("");
        Alert.alert(
          payload.status === "ALREADY_CHECKED_IN" ? "Already Checked In" : "Check-in Confirmed",
          message
        );
        await loadClasses();
      } catch (err: any) {
        const message = err?.response?.data?.message || "Unable to check in this QR code.";
        setStatusError(message);
        Alert.alert("Check-in Failed", message);
      } finally {
        setSubmitting(false);
        setScanLocked(true);
        setTimeout(() => setScanLocked(false), 1500);
      }
    },
    [loadClasses, selectedClassId, submitting]
  );

  const checkedInCount = selectedClass?.signups?.filter((item) => item.checkedInAt).length || 0;
  const reservedCount = selectedClass?.signups?.length || 0;

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
                  onPress={() => setSelectedClassId(item.id)}
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
    backgroundColor: theme.colors.surfaceTranslucent,
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
    backgroundColor: theme.colors.surfaceTranslucent,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10
  },
  classChipActive: {
    backgroundColor: theme.colors.accentMutedTranslucent,
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
  button: {
    backgroundColor: theme.colors.accentMutedTranslucent,
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
