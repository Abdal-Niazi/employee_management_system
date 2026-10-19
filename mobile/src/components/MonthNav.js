import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";
import { addMonths, formatMonth } from "../utils/date";

// Previous / next month bar. `current` is the company's month, from the server, so the next button
// stops there whatever month the phone thinks it is.
export default function MonthNav({ month, current, onChange }) {
  const atCurrent = !current || month >= current;

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel="Previous month"
        onPress={() => onChange(addMonths(month, -1))}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={styles.label}>
        <Text style={font.heading}>{formatMonth(month)}</Text>
      </View>
      <Pressable
        accessibilityLabel="Next month"
        disabled={atCurrent}
        onPress={() => onChange(addMonths(month, 1))}
        style={({ pressed }) => [styles.button, (pressed || atCurrent) && { opacity: 0.35 }]}
      >
        <Ionicons name="chevron-forward" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, alignItems: "center" },
});
