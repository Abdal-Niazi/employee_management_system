import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import SignOutButton from "../../../components/SignOutButton";
import { colors, spacing } from "../../../theme";

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

export default function EmployeesLayout() {
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
});
