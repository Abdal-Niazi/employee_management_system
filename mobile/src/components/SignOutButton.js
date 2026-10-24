import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { colors, spacing } from "../theme";

// The sign-out icon in the header of every role's tabs (HR, manager and employee).
export default function SignOutButton() {
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

const styles = StyleSheet.create({
  signOut: { marginRight: spacing.lg, padding: spacing.xs },
});
