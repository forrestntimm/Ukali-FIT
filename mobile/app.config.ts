import type { ExpoConfig } from "expo/config";

const staticConfig = require("./app.json").expo as {
  version?: string;
  ios?: { buildNumber?: string };
  android?: { versionCode?: number };
};

const variant = process.env.APP_VARIANT === "coach" || process.env.EXPO_PUBLIC_APP_VARIANT === "coach" ? "coach" : "athlete";
const isCoach = variant === "coach";
const appVersion = process.env.APP_VERSION?.trim() || staticConfig.version || "1.0.0";
const iosBuildNumber = isCoach
  ? process.env.IOS_BUILD_NUMBER_COACH?.trim() || staticConfig.ios?.buildNumber || "1"
  : process.env.IOS_BUILD_NUMBER_ATHLETE?.trim() || staticConfig.ios?.buildNumber || "1";
const androidVersionCode = Number.parseInt(
  isCoach
    ? process.env.ANDROID_VERSION_CODE_COACH || String(staticConfig.android?.versionCode || 1)
    : process.env.ANDROID_VERSION_CODE_ATHLETE || String(staticConfig.android?.versionCode || 1),
  10
);
const expoProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || "e7d45f6a-4623-4cab-b778-02863de7e781";
const athleteBundleId = "com.forresttimm.ukalifit";
const coachBundleId = "com.forresttimm.ukaliadmin";
const appIconPath = isCoach ? "./assets/icons/coach-icon.png" : "./assets/icons/athlete-icon.png";
const adaptiveIconPath = isCoach ? "./assets/icons/coach-adaptive-icon.png" : "./assets/icons/athlete-adaptive-icon.png";

const config: ExpoConfig = {
  name: isCoach ? "Ukali Admin" : "Ukali Fit",
  slug: "ukali-gym",
  scheme: isCoach ? "ukali-coach" : "ukali",
  version: appVersion,
  sdkVersion: "50.0.0",
  platforms: ["ios", "android"],
  orientation: "portrait",
  icon: appIconPath,
  splash: {
    image: "./assets/wallpaper-logo.png",
    resizeMode: "contain",
    backgroundColor: "#0D1117"
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  plugins: [
    [
      "expo-secure-store",
      {
        faceIDPermission: "Allow Ukali Fit to use Face ID so you can unlock your saved login securely."
      }
    ],
    [
      "expo-camera",
      {
        cameraPermission: "Allow Ukali Fit admin to scan member QR codes for class check-in."
      }
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Ukali Fit to access your photo library so you can set a profile photo.",
        cameraPermission: "Allow Ukali Fit to use the camera so you can take a profile photo."
      }
    ]
    ,
    "expo-notifications"
  ],
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: isCoach ? coachBundleId : athleteBundleId,
    buildNumber: iosBuildNumber,
    supportsTablet: true,
    config: {
      usesNonExemptEncryption: false
    }
  },
  android: {
    package: isCoach ? coachBundleId : athleteBundleId,
    versionCode: Number.isFinite(androidVersionCode) && androidVersionCode > 0 ? androidVersionCode : 1,
    adaptiveIcon: {
      foregroundImage: adaptiveIconPath,
      backgroundColor: "#0F172A"
    }
  },
  extra: {
    appVariant: variant,
    ...(expoProjectId
      ? {
          eas: {
            projectId: expoProjectId
          }
        }
      : {})
  }
};

export default { expo: config };
