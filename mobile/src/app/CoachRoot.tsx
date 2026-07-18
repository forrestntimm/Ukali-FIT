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
import { syncRegisteredPushToken } from "../lib/pushNotifications";
import LoginScreen from "../screens/LoginScreen";
import CoachAccessScreen from "../screens/CoachAccessScreen";
import AdminScanScreen from "../screens/AdminScanScreen";
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import AdminMembersScreen from "../screens/AdminMembersScreen";
import AdminClassesManageScreen from "../screens/AdminClassesManageScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AppLoadingScreen from "../components/AppLoadingScreen";
import { writeScreenCache } from "../lib/screenCache";
import { theme } from "../theme";

const CoachTabs = createBottomTabNavigator();
const RootStack = createStackNavigator();
const CoachStack = createStackNavigator();
const COACH_NOTIFICATIONS_PROMPTED_STORAGE_KEY_PREFIX = "ukali_coach_notifications_prompted_v1:";

type AdminClassesSummaryItem = {
  id: string;
  title: string;
  datetime: string;
  status: "OPEN" | "CLOSED" | "CANCELED";
  capacity: number;
  reservationCount?: number;
  checkedInCount?: number;
};

type AdminDashboardCacheEnvelope = {
  classes: AdminClassesSummaryItem[];
  selectedClassId: string;
  signups: Array<{
    id: string;
    checkedInAt?: string | null;
    user?: {
      id: string;
      name: string;
      email: string;
      paymentStatus?: "PAID" | "UNPAID";
    };
  }>;
  wod: {
    id: string;
    date: string;
    description: string;
  } | null;
  savedAt: number;
};

type AdminMemberOption = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  paymentStatus?: "PAID" | "UNPAID";
};

type AdminPaymentsPlan = {
  code: string;
  name: string;
  amount: number;
  currency: "NPR";
  description: string;
  quantityEnabled: boolean;
  category: "membership" | "per-class";
};

function tabIconName(routeName: string) {
  switch (routeName) {
    case "Dashboard":
      return "grid-outline" as const;
    case "Members":
      return "people-outline" as const;
    case "Classes":
      return "calendar-outline" as const;
    case "Check-In":
      return "qr-code-outline" as const;
    case "Profile":
      return "person-circle-outline" as const;
    default:
      return "ellipse-outline" as const;
  }
}

function buildTabScreenOptions(routeName: string) {
  return {
    headerShown: false,
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

function CoachTabsNavigator() {
  return (
    <CoachTabs.Navigator detachInactiveScreens={false} screenOptions={({ route }) => buildTabScreenOptions(route.name)}>
      <CoachTabs.Screen name="Dashboard" component={AdminDashboardScreen} />
      <CoachTabs.Screen name="Members" component={AdminMembersScreen} />
      <CoachTabs.Screen
        name="Classes"
        component={AdminClassesManageScreen}
        options={{
          // Keep the classes shell mounted so opening this tab does not pay a first-tap mount penalty.
          lazy: false
        }}
      />
      <CoachTabs.Screen name="Check-In" component={AdminScanScreen} />
      <CoachTabs.Screen name="Profile" component={ProfileScreen} />
    </CoachTabs.Navigator>
  );
}

function CoachManagementStack() {
  return (
    <CoachStack.Navigator screenOptions={{ headerShown: false }}>
      <CoachStack.Screen name="CoachTabs" component={CoachTabsNavigator} />
    </CoachStack.Navigator>
  );
}

export default function CoachRoot() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;

    const run = async () => {
      try {
        const [classRes, workoutOrTodayRes, memberOptionsRes, paymentPlansRes, coachStatsRes] = await Promise.allSettled([
          api.get("/classes", { params: { mine: "true", summary: "true", limit: "20" } }),
          api.get("/workouts/today"),
          api.get("/users/member-options"),
          api.get("/payments/plans"),
          api.get("/users/me/coach-stats")
        ]);
        const classes =
          classRes.status === "fulfilled"
            ? ((classRes.value.data as AdminClassesSummaryItem[]) || []).filter((item) => item.status !== "CANCELED")
            : [];
        const defaultClassId = classes[0]?.id || "";
        const [signupsRes] = await Promise.allSettled([
          defaultClassId ? api.get(`/classes/${defaultClassId}/signups`) : Promise.resolve({ data: [] })
        ]);
        const memberOptions =
          memberOptionsRes.status === "fulfilled"
            ? ((memberOptionsRes.value.data as AdminMemberOption[]) || [])
                .filter((member) => member.role === "MEMBER")
                .sort((a, b) => a.name.localeCompare(b.name))
            : [];
        await writeScreenCache("admin-classes", {
          classes,
          savedAt: Date.now()
        });
        await writeScreenCache<AdminDashboardCacheEnvelope>("admin-dashboard", {
          classes,
          selectedClassId: defaultClassId,
          signups: signupsRes.status === "fulfilled" ? signupsRes.value.data : [],
          wod: workoutOrTodayRes.status === "fulfilled" ? ((workoutOrTodayRes.value.data as AdminDashboardCacheEnvelope["wod"]) ?? null) : null,
          savedAt: Date.now()
        });
        await writeScreenCache("admin-members", {
          members: memberOptions,
          savedAt: Date.now()
        });
        await writeScreenCache("admin-payments", {
          members: memberOptions,
          plans: paymentPlansRes.status === "fulfilled" ? ((paymentPlansRes.value.data as AdminPaymentsPlan[]) ?? []) : [],
          savedAt: Date.now()
        });
        await writeScreenCache("admin-scan", {
          classes,
          selectedClassId: defaultClassId,
          classRoster: signupsRes.status === "fulfilled" ? signupsRes.value.data : []
        });
        await writeScreenCache("admin-profile", {
          classesCoached: coachStatsRes.status === "fulfilled" ? Number(coachStatsRes.value.data?.classesCoached || 0) : 0,
          coachSchedule: classes,
          savedAt: Date.now()
        });
      } catch (error) {
        console.error("[dashboard] Coach prefetch failed", error);
      }
    };

    void run();
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;

    const promptStorageKey = `${COACH_NOTIFICATIONS_PROMPTED_STORAGE_KEY_PREFIX}${user.id}`;
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
          "Get alerts for announcements, coaching schedule updates, and weekly workouts.",
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
                    console.error("[push] Coach permission flow failed", error);
                  }
                })();
              }
            }
          ]
        );
      } catch (error) {
        console.error("[push] Coach startup registration failed", error);
      }
    };

    void run();
  }, [user?.id, user?.role]);

  if (loading) return <AppLoadingScreen />;

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? <RootStack.Screen name="Login" component={LoginScreen} /> : null}
      {user && user.role !== "ADMIN" ? <RootStack.Screen name="CoachOnly" component={CoachAccessScreen} /> : null}
      {user && user.role === "ADMIN" ? <RootStack.Screen name="CoachMain" component={CoachManagementStack} /> : null}
    </RootStack.Navigator>
  );
}
