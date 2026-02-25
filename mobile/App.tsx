import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import ClassesScreen from "./src/screens/ClassesScreen";
import CommunityScreen from "./src/screens/CommunityScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import CoachAccessScreen from "./src/screens/CoachAccessScreen";
import * as Notifications from "expo-notifications";
import { theme } from "./src/theme";
import { IS_COACH_APP } from "./src/config/appVariant";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

const Tabs = createBottomTabNavigator();
const Stack = createStackNavigator();
const CoachCheckInScreen = IS_COACH_APP ? require("./src/screens/AdminScanScreen").default : null;

function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
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
          fontWeight: "600"
        },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "Dashboard"
              ? "grid-outline"
              : route.name === "Classes"
                ? "calendar-outline"
                : route.name === "Announcements"
                  ? "chatbubble-ellipses-outline"
                  : route.name === "Check-In"
                    ? "qr-code-outline"
                    : "person-circle-outline";
          return <Ionicons name={iconName} size={size + 2} color={color} />;
        }
      })}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} />
      <Tabs.Screen name="Classes" component={ClassesScreen} />
      <Tabs.Screen name="Announcements" component={CommunityScreen} />
      {IS_COACH_APP && CoachCheckInScreen ? <Tabs.Screen name="Check-In" component={CoachCheckInScreen} /> : null}
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (IS_COACH_APP && user.role !== "ADMIN" ? <Stack.Screen name="CoachOnly" component={CoachAccessScreen} /> : <Stack.Screen name="Main" component={AppTabs} />) : <Stack.Screen name="Login" component={LoginScreen} />}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: theme.colors.accent,
            background: theme.colors.background,
            card: theme.colors.surface,
            text: theme.colors.textPrimary,
            border: theme.colors.border,
            notification: theme.colors.danger
          }
        }}
      >
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
