import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, spacing } from "../theme";
import SignOutButton from "./SignOutButton";

// The header's account icons for every role: change your password, and sign out.
export default function AccountButtons() {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push("/change-password")}
        accessibilityRole="button"
        accessibilityLabel="Change password"
        hitSlop={8}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="key-outline" size={21} color={colors.text} />
      </Pressable>
      <SignOutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  button: { padding: spacing.xs },
});
