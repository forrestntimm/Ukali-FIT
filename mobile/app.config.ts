import type { ExpoConfig } from "expo/config";

const variant = process.env.APP_VARIANT === "coach" || process.env.EXPO_PUBLIC_APP_VARIANT === "coach" ? "coach" : "athlete";
const isCoach = variant === "coach";

const config: ExpoConfig = {
  name: isCoach ? "Ukali Coach" : "Ukali Fit",
  slug: isCoach ? "ukali-coach" : "ukali-gym",
  scheme: isCoach ? "ukali-coach" : "ukali",
  version: "1.0.0",
  sdkVersion: "50.0.0",
  platforms: ["ios", "android"],
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0F172A"
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  plugins: [
    [
      "expo-camera",
      {
        cameraPermission: "Allow Ukali Fit admin to scan member QR codes for class check-in."
      }
    ]
  ],
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: isCoach ? "com.ukalifit.coach" : "com.ukalifit.app",
    supportsTablet: true
  },
  android: {
    package: isCoach ? "com.ukalifit.coach" : "com.ukalifit.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0F172A"
    }
  },
  extra: {
    appVariant: variant
  }
};

export default { expo: config };
