import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import OfflineScreen from "../components/OfflineScreen";
import { LoadingState } from "../components/States";
import { colors } from "../theme";

// Each role only gets its own screens. When a guard turns false (sign in/out),
// Expo Router moves to the first screen that is still available.
function RootNavigator() {
  const { user, restoring, unreachable, retry, logout } = useAuth();
  // Only manager accounts get the team screens; the API refuses everyone else there too.
  const isManager = user?.role === "manager";
  // Employee accounts get their own check-in and attendance screens.
  const isEmployee = user?.role === "employee";

  // A spinner, not the login screen, while a saved session is being checked.
  if (restoring) return <LoadingState />;
  // No connection at start: keep the session and offer a retry instead of the login screen.
  if (unreachable) return <OfflineScreen onRetry={retry} onSignOut={logout} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={isManager}>
        <Stack.Screen name="(manager)" />
        <Stack.Screen
          name="member/[id]"
          options={{ headerShown: true, title: "Team member", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="corrections"
          options={{ headerShown: true, title: "Correction requests", headerBackTitle: "Back" }}
        />
      </Stack.Protected>

      <Stack.Protected guard={isEmployee}>
        <Stack.Screen name="(employee)" />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(user) && !isManager && !isEmployee}>
        <Stack.Screen name="coming-soon" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
