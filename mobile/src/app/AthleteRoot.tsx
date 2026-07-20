import React, { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { Alert } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { writeScreenCache } from "../lib/screenCache";
import { syncRegisteredPushToken } from "../lib/pushNotifications";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import ClassesScreen from "../screens/ClassesScreen";
import CommunityScreen from "../screens/CommunityScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AppLoadingScreen from "../components/AppLoadingScreen";
import { theme } from "../theme";

const AthleteTabs = createBottomTabNavigator();
const RootStack = createStackNavigator();
const ATHLETE_NOTIFICATIONS_PROMPTED_STORAGE_KEY_PREFIX = "ukali_athlete_notifications_prompted_v1:";

function tabIconName(routeName: string) {
  switch (routeName) {
    case "Dashboard":
      return "grid-outline" as const;
    case "Classes":
      return "calendar-outline" as const;
    case "Announcements":
      return "chatbubble-ellipses-outline" as const;
    case "Profile":
      return "person-circle-outline" as const;
    default:
      return "ellipse-outline" as const;
  }
}

function buildTabScreenOptions(routeName: string) {
  return {
    headerShown: false,
    // Mount every tab at startup so switching tabs never pays a first-tap
    // mount penalty; screens render instantly from their warm caches.
    lazy: false,
    tabBarActiveTintColor: theme.colors.textPrimary,
    tabBarInactiveTintColor: theme.colors.textSecondary,
    tabBarStyle: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.border,
      borderTopWidth: 1,
      height: 74,
      paddingTop: 8,
      paddingBottom: 10
    },
    tabBarLabelStyle: {
      fontSize: 12,
      fontWeight: "600" as const
    },
    tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name={tabIconName(routeName)} size={size + 2} color={color} />
  };
}

function AthleteTabsNavigator() {
  return (
    <AthleteTabs.Navigator detachInactiveScreens={false} screenOptions={({ route }) => buildTabScreenOptions(route.name)}>
      <AthleteTabs.Screen name="Dashboard" component={DashboardScreen} />
      <AthleteTabs.Screen name="Classes" component={ClassesScreen} />
      <AthleteTabs.Screen name="Announcements" component={CommunityScreen} />
      <AthleteTabs.Screen name="Profile" component={ProfileScreen} />
    </AthleteTabs.Navigator>
  );
}

export default function AthleteRoot() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user || user.role !== "MEMBER") return;

    const run = async () => {
      try {
        const [classesRes, announcementsRes] = await Promise.allSettled([
          api.get("/classes"),
          api.get("/announcements")
        ]);

        if (classesRes.status === "fulfilled") {
          await writeScreenCache("classes", {
            classes: classesRes.value.data,
            savedAt: Date.now()
          });
        }

        if (announcementsRes.status === "fulfilled") {
          await writeScreenCache("announcements", {
            announcements: announcementsRes.value.data,
            savedAt: Date.now()
          });
        }
      } catch (error) {
        console.error("[tabs] Athlete prefetch failed", error);
      }
    };

    void run();
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user) return;

    const promptStorageKey = `${ATHLETE_NOTIFICATIONS_PROMPTED_STORAGE_KEY_PREFIX}${user.id}`;
    const isDesktopAppleRuntime = Device.osName === "macOS";

    const run = async () => {
      try {
        if (!Device.isDevice || isDesktopAppleRuntime) return;

        const syncedToken = await syncRegisteredPushToken();
        if (syncedToken) {
          await AsyncStorage.setItem(promptStorageKey, "1");
          return;
        }

        const hasPrompted = (await AsyncStorage.getItem(promptStorageKey)) === "1";
        if (hasPrompted) return;

        Alert.alert(
          "Allow notifications?",
          "Get alerts for new announcements and payment reminders before membership expires.",
          [
            {
              text: "Not now",
              style: "cancel",
              onPress: () => {
                void AsyncStorage.setItem(promptStorageKey, "1");
              }
            },
            {
              text: "Allow",
              onPress: () => {
                void (async () => {
                  try {
                    await AsyncStorage.setItem(promptStorageKey, "1");
                    const requested = await Notifications.requestPermissionsAsync();
                    if (requested.status !== "granted") return;
                    await syncRegisteredPushToken();
                  } catch (error) {
                    console.error("[push] Athlete permission flow failed", error);
                  }
                })();
              }
            }
          ]
        );
      } catch (error) {
        console.error("[push] Athlete startup registration failed", error);
      }
    };

    void run();
  }, [user?.id]);

  if (loading) return <AppLoadingScreen />;

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? <RootStack.Screen name="Login" component={LoginScreen} /> : null}
      {user ? <RootStack.Screen name="AthleteMain" component={AthleteTabsNavigator} /> : null}
    </RootStack.Navigator>
  );
}
