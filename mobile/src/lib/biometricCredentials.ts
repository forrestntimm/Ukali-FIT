import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { APP_DISPLAY_NAME, IS_COACH_APP } from "../config/appVariant";

type BiometricCredentials = {
  email: string;
  password: string;
};

type BiometricCredentialMetadata = {
  email: string;
};

const BIOMETRIC_CREDENTIALS_KEY = IS_COACH_APP ? "ukali_coach_biometric_credentials_v1" : "ukali_athlete_biometric_credentials_v1";
const BIOMETRIC_METADATA_STORAGE_KEY = IS_COACH_APP ? "ukali-coach-biometric-login-v1" : "ukali-athlete-biometric-login-v1";

const BIOMETRIC_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: `Use Face ID to access your saved ${APP_DISPLAY_NAME} login.`,
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY
};

export async function getBiometricCredentialMetadata(): Promise<BiometricCredentialMetadata | null> {
  try {
    const raw = await AsyncStorage.getItem(BIOMETRIC_METADATA_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BiometricCredentialMetadata) : null;
  } catch {
    return null;
  }
}

async function setBiometricCredentialMetadata(metadata: BiometricCredentialMetadata | null) {
  if (!metadata) {
    await AsyncStorage.removeItem(BIOMETRIC_METADATA_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(BIOMETRIC_METADATA_STORAGE_KEY, JSON.stringify(metadata));
}

export async function saveBiometricCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password.trim()) {
    return false;
  }

  if (!(await SecureStore.isAvailableAsync())) {
    return false;
  }

  try {
    await SecureStore.setItemAsync(
      BIOMETRIC_CREDENTIALS_KEY,
      JSON.stringify({ email: normalizedEmail, password }),
      BIOMETRIC_STORE_OPTIONS
    );
    await setBiometricCredentialMetadata({ email: normalizedEmail });
    return true;
  } catch {
    return false;
  }
}

export async function getBiometricCredentials(): Promise<BiometricCredentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY, BIOMETRIC_STORE_OPTIONS);
    if (!raw) {
      await clearBiometricCredentials();
      return null;
    }

    const parsed = JSON.parse(raw) as BiometricCredentials;
    if (!parsed.email || !parsed.password) {
      await clearBiometricCredentials();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function clearBiometricCredentials() {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
  } finally {
    await setBiometricCredentialMetadata(null);
  }
}
