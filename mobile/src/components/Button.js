import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing } from "../theme";

const VARIANTS = {
  primary: { bg: colors.primary, fg: "#fff", border: colors.primary },
  success: { bg: colors.success, fg: "#fff", border: colors.success },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  dangerSolid: { bg: colors.danger, fg: "#fff", border: colors.danger },
  outline: { bg: colors.surface, fg: colors.text, border: colors.border },
};

export default function Button({ title, onPress, variant = "primary", icon, loading, disabled, style }) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        icon && <Ionicons name={icon} size={18} color={v.fg} />
      )}
      <Text style={[styles.label, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  label: { fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
