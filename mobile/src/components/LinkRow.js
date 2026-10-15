import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

// A full-width row that opens another screen, with an optional count (e.g. requests waiting).
export default function LinkRow({ icon, label, count, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} waiting` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
      {count ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  text: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  badge: {
    minWidth: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
    alignItems: "center",
  },
  badgeText: { fontSize: 13, fontWeight: "700", color: colors.warning },
});
