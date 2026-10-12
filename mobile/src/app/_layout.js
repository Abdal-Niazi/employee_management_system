import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { colors } from "../theme";

// Each role only gets its own screens. When a guard turns false (sign in/out),
// Expo Router moves to the first screen that is still available.
function RootNavigator() {
  const { user, restoring } = useAuth();
  // Only manager accounts get the team screens; the API refuses everyone else there too.
  const isManager = user?.role === "manager";
  const isHrAdmin = user?.role === "hr_admin";
  const isEmployee = user?.role === "employee";

  // Don't flash the login screen while a saved session is being checked.
  if (restoring) return null;

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
      </Stack.Protected>

      <Stack.Protected guard={isHrAdmin}>
        <Stack.Screen name="(hr)" />
      </Stack.Protected>

      <Stack.Protected guard={isEmployee}>
        <Stack.Screen name="(employee)" />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(user) && !isManager && !isHrAdmin && !isEmployee}>
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
