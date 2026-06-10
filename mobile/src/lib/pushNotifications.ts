import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "../api/client";

function resolveExpoProjectId() {
  const configuredProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const easProjectId = Constants.easConfig?.projectId;
  const expoConfigProjectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;

  return configuredProjectId || easProjectId || expoConfigProjectId || null;
}

export async function getExpoPushTokenIfConfigured() {
  const projectId = resolveExpoProjectId();
  if (!projectId) {
    console.warn("[push] Missing Expo projectId; skipping Expo push token registration.");
    return null;
  }

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

export async function syncRegisteredPushToken() {
  if (!Device.isDevice || Device.osName === "macOS") {
    return null;
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") {
    return null;
  }

  const pushToken = await getExpoPushTokenIfConfigured();
  if (!pushToken) {
    return null;
  }

  await api.post("/devices/register", {
    token: pushToken,
    platform: Device.osName || "unknown"
  });
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.warn("[push] Failed to clear local badge count after sync.", error);
  }

  return pushToken;
}
