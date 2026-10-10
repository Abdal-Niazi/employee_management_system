import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { colors, spacing } from "../theme";

export default function SignOutButton() {
  const { logout } = useAuth();

  return (
    <Pressable
      onPress={logout}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name="log-out-outline" size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: spacing.xs },
});
