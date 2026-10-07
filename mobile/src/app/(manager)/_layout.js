import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { colors, spacing } from "../../theme";

const ICONS = {
  index: "grid",
  team: "people",
  attendance: "calendar",
  leave: "airplane",
};

function SignOutButton() {
  const { logout } = useAuth();
  return (
    <Pressable
      onPress={logout}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      hitSlop={8}
      style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name="log-out-outline" size={22} color={colors.text} />
    </Pressable>
  );
}

export default function ManagerLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { fontWeight: "700" },
        headerRight: () => <SignOutButton />,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={focused ? ICONS[route.name] : `${ICONS[route.name]}-outline`} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Overview" }} />
      <Tabs.Screen name="team" options={{ title: "My Team" }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance" }} />
      <Tabs.Screen name="leave" options={{ title: "Leave" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  signOut: { marginRight: spacing.lg, padding: spacing.xs },
});
