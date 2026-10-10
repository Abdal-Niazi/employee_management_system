import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { colors, spacing } from "../../theme";

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

function HeaderButtons() {
  const router = useRouter();
  return (
    <View style={styles.buttons}>
      <Pressable
        onPress={() => router.push("/employee/new")}
        accessibilityRole="button"
        accessibilityLabel="Add employee"
        hitSlop={8}
        style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="person-add-outline" size={22} color={colors.primary} />
      </Pressable>
      <SignOutButton />
    </View>
  );
}

export default function HrLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontWeight: "700" },
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Employees", headerRight: () => <HeaderButtons /> }} />
      <Stack.Screen name="employee/[id]" options={{ title: "Employee" }} />
      <Stack.Screen name="employee/new" options={{ title: "New employee" }} />
      <Stack.Screen name="employee/edit/[id]" options={{ title: "Edit employee" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerButton: { padding: spacing.xs },
  signOut: { padding: spacing.xs },
});
